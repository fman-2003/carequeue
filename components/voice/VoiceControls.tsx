"use client";

import { useEffect } from "react";
import { useVoiceRecorder } from "@/lib/hooks/useVoiceRecorder";

interface Props {
  /** True while the chat panel is open. The mic is switched off when it closes. */
  active: boolean;
  /** Stops a new recording from starting while a chat request is running. */
  disabled?: boolean;
  onTranscript: (text: string) => void;
}

export default function VoiceControls({
  active,
  disabled = false,
  onTranscript,
}: Props) {
  const { status, error, start, stop, cancel } = useVoiceRecorder({
    onTranscript,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!active) cancel();
  }, [active, cancel]);

  const recording = status === "recording";
  const transcribing = status === "transcribing";
  const showError = Boolean(error) && status === "idle";

  function handleClick() {
    if (recording) stop();
    else if (status === "idle") void start();
  }

  const hint = recording
    ? "Listening… tap the button again to stop"
    : transcribing
      ? "Writing down what you said…"
      : "Tap the mic and speak (up to 30 seconds)";

  return (
    <div className="flex items-center gap-3 mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={(disabled && status === "idle") || transcribing}
        aria-label={recording ? "Stop recording" : "Start recording"}
        aria-pressed={recording}
        title={recording ? "Stop recording" : "Speak your request"}
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white transition disabled:opacity-50 ${
          recording
            ? "bg-red-600 animate-pulse"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {recording ? (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
          </svg>
        )}
      </button>
      <p
        className={`text-xs ${showError ? "text-red-500" : "text-gray-500"}`}
        aria-live="polite"
      >
        {showError ? error : hint}
      </p>
    </div>
  );
}
