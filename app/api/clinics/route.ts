import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
  forbidden,
} from "@/lib/auth/middleware";
import { createClinicSchema } from "@/lib/validations/clinic.schema";
import { createClinic } from "@/lib/services/clinic.service";
import { signToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { handleServiceError, readJson } from "@/lib/security/errors";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  // only admins can register a clinic
  const roleError = requireRole(payload.role, ["admin"]);
  if (roleError) return roleError;

  // An admin owns exactly one clinic. Without this, one account could
  // create clinics indefinitely and mint itself a new clinic scope each
  // time.
  if (payload.clinicId) {
    return forbidden("Your account is already linked to a clinic");
  }

  try {
    const body = await readJson(req);
    const parsed = createClinicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    const clinic = await createClinic(parsed.data, payload.userId);

    const token = signToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      clinicId: clinic._id.toString(),
    });

    return setSessionCookie(
      NextResponse.json({ clinic }, { status: 201 }),
      token,
    );
  } catch (err) {
    return handleServiceError("clinics POST", err, 400);
  }
}
