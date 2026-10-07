import { AppError } from "@/lib/security/errors";
import type { AudioKind } from "@/lib/security/fileValidation";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";
const LANGUAGE = "en";
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Sends one voice clip to Groq Whisper and returns the text.
 * Audio is never stored. It lives in memory for this request only.
 * Returns "" when no speech was heard.
 */
export async function transcribeAudio(
  buffer: Buffer,
  kind: AudioKind,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error("[transcription] GROQ_API_KEY is not configured");
    throw new AppError("Voice transcription is not available right now", 503);
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: kind.mime }),
    `voice.${kind.extension}`,
  );
  form.append("model", GROQ_MODEL);
  form.append("language", LANGUAGE);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // No Content-Type header: fetch adds it with the correct multipart boundary.
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      console.error(
        `[transcription] Groq returned ${response.status}: ${detail}`,
      );

      if (response.status === 429) {
        throw new AppError(
          "The voice service is busy. Please try again shortly.",
          503,
        );
      }
      throw new AppError("Voice transcription failed. Please try again.", 502);
    }

    const data = (await response.json()) as { text?: unknown };
    return typeof data.text === "string" ? data.text.trim() : "";
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("[transcription] request failed", err);
    throw new AppError("Voice transcription failed. Please try again.", 502);
  } finally {
    clearTimeout(timer);
  }
}
