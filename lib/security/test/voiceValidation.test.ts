import { describe, expect, it } from "vitest";
import {
  validateVoiceClip,
  VOICE_MAX_BYTES,
} from "@/lib/security/fileValidation";

const file = (bytes: number[], type: string) =>
  new File([new Uint8Array(bytes)], "clip", { type });

const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const OGG = [0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const MP4 = [0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0];
const WAV = [
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0, 0, 0, 0,
];
const HTML = Array.from("<script>alert(1)</script>").map((c) =>
  c.charCodeAt(0),
);

describe("validateVoiceClip", () => {
  it("accepts WebM even when the declared type carries codec text", async () => {
    const result = await validateVoiceClip(
      file(WEBM, "audio/webm;codecs=opus"),
    );
    expect(result.kind.extension).toBe("webm");
  });

  it("accepts OGG, MP4 and WAV (including the x-wav alias)", async () => {
    expect(
      (await validateVoiceClip(file(OGG, "audio/ogg;codecs=opus"))).kind
        .extension,
    ).toBe("ogg");
    expect(
      (await validateVoiceClip(file(MP4, "audio/mp4"))).kind.extension,
    ).toBe("m4a");
    expect(
      (await validateVoiceClip(file(WAV, "audio/x-wav"))).kind.extension,
    ).toBe("wav");
  });

  it("rejects HTML wearing an audio content-type", async () => {
    await expect(validateVoiceClip(file(HTML, "audio/webm"))).rejects.toThrow(
      /does not match a supported audio type/,
    );
  });

  it("rejects bytes that disagree with the declared type", async () => {
    await expect(validateVoiceClip(file(OGG, "audio/webm"))).rejects.toThrow(
      /declared type/,
    );
  });

  it("rejects a non-audio declared type", async () => {
    await expect(validateVoiceClip(file(WEBM, "image/png"))).rejects.toThrow(
      /Unsupported audio type/,
    );
  });

  it("rejects an empty or missing file", async () => {
    await expect(validateVoiceClip(null)).rejects.toThrow(/No voice clip/);
    await expect(
      validateVoiceClip(new File([], "empty", { type: "audio/webm" })),
    ).rejects.toThrow(/No voice clip/);
  });

  it("rejects a clip over the size limit", async () => {
    const big = new File([new Uint8Array(VOICE_MAX_BYTES + 1)], "big", {
      type: "audio/webm",
    });
    await expect(validateVoiceClip(big)).rejects.toThrow(/under 2MB/);
  });
});
