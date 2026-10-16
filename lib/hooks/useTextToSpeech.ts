/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { makeSpeakable, splitForSpeech } from "@/lib/utils/speakable";
import { logVoiceTiming } from "@/lib/utils/voiceMetrics";

/** Remembers the speaker button. A convenience only. */
const STORAGE_KEY = "cq_voice_replies";

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

const normalise = (lang: string) => lang.replace("_", "-").toLowerCase();

function best(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice {
  // A voice stored on the device needs no network and starts faster.
  return list.find((voice) => voice.localService) ?? list[0];
}

/** Nigerian English first, then British English, then any English voice. */
function pickVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => normalise(v.lang).startsWith("en"));
  for (const lang of ["en-ng", "en-gb"]) {
    const matches = english.filter((v) => normalise(v.lang) === lang);
    if (matches.length > 0) return best(matches);
  }
  return english.length > 0 ? best(english) : null;
}

export function useTextToSpeech() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const supportedRef = useRef(false);
  const enabledRef = useRef(false);
  const mountedRef = useRef(false);
  const unlockedRef = useRef(false);
  /** A new number for every speech. Late events from an old speech are ignored. */
  const runIdRef = useRef(0);
  /** Some browsers stop speaking if the utterance objects are garbage collected. */
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    const ok = isSupported();
    supportedRef.current = ok;
    setSupported(ok);

    if (ok) {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === "on") {
          enabledRef.current = true;
          setEnabled(true);
        }
      } catch {
        // Private browsing: the button simply starts off.
      }
    }

    return () => {
      mountedRef.current = false;
      runIdRef.current++;
      utterancesRef.current = [];
      if (supportedRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  /** Stops any speech right now. */
  const cancel = useCallback(() => {
    runIdRef.current++;
    utterancesRef.current = [];
    if (supportedRef.current) window.speechSynthesis.cancel();
    if (mountedRef.current) setSpeaking(false);
  }, []);

  /**
   * Safari on iPhone only allows speech that was started by a tap. Playing
   * one silent utterance inside a tap lets later replies speak. Best effort.
   */
  const unlock = useCallback(() => {
    if (!supportedRef.current || unlockedRef.current) return;
    unlockedRef.current = true;
    const silent = new SpeechSynthesisUtterance("");
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
  }, []);

  /** Speaks the text, but only when the speaker button is on. */
  const speak = useCallback((text: string) => {
    if (!supportedRef.current || !enabledRef.current) return;

    const synth = window.speechSynthesis;
    synth.cancel();
    const runId = ++runIdRef.current;

    const chunks = splitForSpeech(makeSpeakable(text));
    if (chunks.length === 0) {
      if (mountedRef.current) setSpeaking(false);
      return;
    }

    const voice = pickVoice(synth.getVoices());
    const startedAt = performance.now();
    const utterances = chunks.map((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (voice) utterance.voice = voice;
      utterance.lang = voice ? voice.lang : "en";
      if (index === 0) {
        utterance.onstart = () => {
          if (runIdRef.current !== runId) return;
          logVoiceTiming("tts-start", performance.now() - startedAt, {
            chunks: chunks.length,
            voice: voice ? voice.name : "default",
          });
        };
      }

      const finished = () => {
        if (runIdRef.current !== runId || !mountedRef.current) return;
        if (index === chunks.length - 1) setSpeaking(false);
      };
      utterance.onend = finished;
      utterance.onerror = () => {
        if (runIdRef.current === runId && mountedRef.current) {
          setSpeaking(false);
        }
      };
      return utterance;
    });

    utterancesRef.current = utterances;
    if (mountedRef.current) setSpeaking(true);
    utterances.forEach((utterance) => synth.speak(utterance));
  }, []);

  /** The speaker button. Turning it on counts as the tap that unlocks speech. */
  const toggle = useCallback(() => {
    if (!supportedRef.current) return;

    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Not remembered, but the button still works for this visit.
    }

    if (next) unlock();
    else cancel();
  }, [unlock, cancel]);

  return { supported, enabled, speaking, toggle, speak, cancel, unlock };
}
