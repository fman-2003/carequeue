/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus = "idle" | "recording" | "transcribing";

/** The recording stops by itself after this long. */
const MAX_RECORDING_MS = 30_000;
/** Shorter taps are ignored: they hold no speech. */
const MIN_RECORDING_MS = 600;
/** Mirrors VOICE_MAX_BYTES on the server (lib/security/fileValidation.ts). */
const MAX_CLIP_BYTES = 2 * 1024 * 1024;

/** In order of preference. The server accepts webm, ogg and mp4. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return undefined;
  }
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function createRecorder(stream: MediaStream, mimeType?: string): MediaRecorder {
  try {
    // 32 kbps is plenty for speech and keeps the upload small.
    return new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: 32_000,
    });
  } catch {
    return new MediaRecorder(stream);
  }
}

function microphoneErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The microphone is being used by another app.";
  }
  return "Could not start the microphone. Please try again.";
}

interface Options {
  onTranscript: (text: string) => void;
}

export function useVoiceRecorder({ onTranscript }: Options) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState("");

  const statusRef = useRef<VoiceStatus>("idle");
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  /**
   * Every recording and every upload gets a number. Cancelling, closing the
   * panel or starting again changes the number, so a late event from an old
   * recording can never touch a newer one.
   */
  const runIdRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  const update = useCallback((next: VoiceStatus) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
  }, []);

  const fail = useCallback((message: string) => {
    if (mountedRef.current) setError(message);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      const runId = ++runIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      update("transcribing");

      try {
        const form = new FormData();
        form.append("audio", blob, "voice");

        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));

        // Cancelled or replaced while we were waiting.
        if (runIdRef.current !== runId) return;

        if (!res.ok) {
          fail(
            typeof data.error === "string"
              ? data.error
              : "Could not turn your voice into text. Please try again.",
          );
          return;
        }

        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (!text) {
          fail("I could not hear any speech. Please try again.");
          return;
        }

        onTranscriptRef.current(text);
      } catch {
        if (runIdRef.current === runId) {
          fail(
            "Could not reach the server. Check your connection and try again.",
          );
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (runIdRef.current === runId) update("idle");
      }
    },
    [update, fail],
  );

  /** Ends the recording and sends it. */
  const stop = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, [clearTimer]);

  const start = useCallback(async () => {
    if (statusRef.current !== "idle" || startingRef.current) return;
    setError("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      fail(
        "Voice needs a secure (https) connection and a browser that can record audio.",
      );
      return;
    }

    const runId = ++runIdRef.current;
    startingRef.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      startingRef.current = false;
      if (runIdRef.current === runId) fail(microphoneErrorMessage(err));
      return;
    }
    startingRef.current = false;

    // Cancelled, or the panel closed, while the permission prompt was open.
    if (runIdRef.current !== runId || !mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = createRecorder(stream, mimeType);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      fail("This browser cannot record audio. Please use a different browser.");
      return;
    }

    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onerror = () => {
      if (runIdRef.current !== runId) return;
      runIdRef.current++; // the stop event that follows is ignored
      clearTimer();
      stream.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
      fail("Recording failed. Please try again.");
      update("idle");
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (recorderRef.current === recorder) recorderRef.current = null;

      // Cancelled, closed, or replaced by a newer recording: nothing to send.
      if (runIdRef.current !== runId) return;

      clearTimer();

      const duration = Date.now() - startedAtRef.current;
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });

      if (duration < MIN_RECORDING_MS || blob.size === 0) {
        fail("That was too short. Tap the mic, speak, then tap again.");
        update("idle");
        return;
      }
      if (blob.size > MAX_CLIP_BYTES) {
        fail("That recording is too long. Please keep it shorter.");
        update("idle");
        return;
      }

      void transcribe(blob);
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start();
    update("recording");
    timerRef.current = setTimeout(stop, MAX_RECORDING_MS);
  }, [fail, update, clearTimer, stop, transcribe]);

  /** Throws away any recording or upload in progress. Nothing is sent. */
  const cancel = useCallback(() => {
    runIdRef.current++;
    clearTimer();
    abortRef.current?.abort();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stopStream();
    update("idle");
    if (mountedRef.current) setError("");
  }, [clearTimer, stopStream, update]);

  // Switch everything off when the component goes away.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current++;
      clearTimer();
      abortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopStream();
    };
  }, [clearTimer, stopStream]);

  return { status, error, start, stop, cancel };
}
