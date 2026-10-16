/**
 * Timing notes for the voice feature. Each step logs one line to the browser
 * console and keeps a copy in window.__voiceTimings, so a tester can copy the
 * numbers out. Only numbers and yes/no flags are kept. Never put spoken or
 * typed text in here, because it can hold patient details.
 */
export interface VoiceTiming {
  step: string;
  ms: number | null;
  at: string;
  details: Record<string, string | number | boolean>;
}

const MAX_ENTRIES = 200;
const entries: VoiceTiming[] = [];

export function logVoiceTiming(
  step: string,
  ms: number | null,
  details: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === "undefined") return;

  const entry: VoiceTiming = {
    step,
    ms: ms === null ? null : Math.round(ms),
    at: new Date().toISOString(),
    details,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  (window as unknown as { __voiceTimings?: VoiceTiming[] }).__voiceTimings =
    entries;

  console.info(
    "[voice]",
    step,
    entry.ms === null ? "" : `${entry.ms}ms`,
    details,
  );
}
