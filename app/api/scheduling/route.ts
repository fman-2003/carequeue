import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireClinic,
  forbidden,
} from "@/lib/auth/middleware";
import { smartSchedule } from "@/lib/services/scheduling.service";
import { schedulingSchema } from "@/lib/validations/scheduling.schema";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleServiceError, readJson } from "@/lib/security/errors";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  /**
   * Each call fans out into a 14-day availability scan and then a paid
   * Anthropic request. Unthrottled, a signed-in account can run up the
   * API bill and the database load at will.
   */
  const limited = enforceRateLimit(
    req,
    "scheduling",
    RATE_LIMITS.ai,
    payload.userId,
  );
  if (limited) return limited;

  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    const body = await readJson(req);
    const parsed = schedulingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    /**
     * clinicId came from the request body and was never compared to the
     * caller's own clinic, so anyone could enumerate the doctors and full
     * availability of any clinic on the platform through this endpoint.
     */
    if (parsed.data.clinicId !== clinicId) {
      return forbidden("You can only schedule within your own clinic");
    }

    const result = await smartSchedule({
      clinicId,
      patientId: payload.userId,
      message: parsed.data.message,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError("scheduling POST", err, 500);
  }
}
