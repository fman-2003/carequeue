import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireClinic,
  badRequest,
} from "@/lib/auth/middleware";
import {
  validateVoiceClip,
  VOICE_MAX_BYTES,
} from "@/lib/security/fileValidation";
import { transcribeAudio } from "@/lib/services/transcription.service";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleServiceError } from "@/lib/security/errors";

// The clip plus a little room for the multipart envelope.
const MAX_REQUEST_BYTES = VOICE_MAX_BYTES + 64 * 1024;

/**
 * Turns one voice clip into text. It returns { text } and nothing else.
 * The patient checks the text and sends it to /api/scheduling themselves,
 * so this route never books or reads anything.
 */
export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const limited = enforceRateLimit(
    req,
    "voice-transcribe",
    RATE_LIMITS.voice,
    payload.userId,
  );
  if (limited) return limited;

  const { error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  // Rejects an oversized upload before the body is read into memory.
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "Voice clip is too large" },
      { status: 413 },
    );
  }

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return badRequest("Invalid form data");
    }

    const clip = await validateVoiceClip(formData.get("audio"));
    const text = await transcribeAudio(clip.buffer, clip.kind);

    return NextResponse.json({ text });
  } catch (err) {
    return handleServiceError("voice/transcribe POST", err, 500);
  }
}
