import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "../transcription.service";

const kind = { mime: "audio/webm", extension: "webm" };
const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the clip to Groq with the key and returns trimmed text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ text: "  Book me for Friday  " }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeAudio(audio, kind)).resolves.toBe(
      "Book me for Friday",
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-groq-key");

    const body = init.body as FormData;
    expect(body.get("model")).toBe("whisper-large-v3-turbo");
    expect(body.get("language")).toBe("en");
    const sent = body.get("file") as File;
    expect(sent.name).toBe("voice.webm");
  });

  it("returns an empty string when no text comes back", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) }),
    );
    await expect(transcribeAudio(audio, kind)).resolves.toBe("");
  });

  it("fails without calling Groq when the key is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeAudio(audio, kind)).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a Groq rate limit to a busy message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("rate limited"),
      }),
    );
    await expect(transcribeAudio(audio, kind)).rejects.toMatchObject({
      status: 503,
      message: "The voice service is busy. Please try again shortly.",
    });
  });

  it("hides Groq error details and network failures behind a generic message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("internal detail"),
      }),
    );
    await expect(transcribeAudio(audio, kind)).rejects.toMatchObject({
      status: 502,
      message: "Voice transcription failed. Please try again.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("socket hang up")),
    );
    await expect(transcribeAudio(audio, kind)).rejects.toMatchObject({
      status: 502,
      message: "Voice transcription failed. Please try again.",
    });
  });
});
