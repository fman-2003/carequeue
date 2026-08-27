import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireClinic,
} from "@/lib/auth/middleware";
import { resolvePatientAccess } from "@/lib/auth/access";
import { medicalProfileSchema } from "@/lib/validations/ehr.schema";
import {
  getMedicalProfile,
  upsertMedicalProfile,
} from "@/lib/services/ehr.service";
import { handleRouteError, readJson } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);

  // Ownership is proven here rather than inferred from the caller's role.
  const access = await resolvePatientAccess(
    payload,
    searchParams.get("patientId"),
  );
  if (access.error) return access.error;

  try {
    const profile = await getMedicalProfile(access.patientId);
    return NextResponse.json({ profile });
  } catch (err) {
    return handleRouteError("ehr/profile GET", err);
  }
}

export async function PATCH(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    const body = (await readJson(req)) as Record<string, unknown>;

    const access = await resolvePatientAccess(payload, body?.patientId);
    if (access.error) return access.error;

    const parsed = medicalProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    /**
     * The clinic is taken from the verified session, never from the body.
     * For a doctor it is their own clinic, which resolvePatientAccess has
     * already matched against the patient's; for a patient it is the
     * clinic they registered with.
     */
    const clinicError = requireClinic(payload).error;
    if (clinicError) return clinicError;

    const profile = await upsertMedicalProfile(
      access.patientId,
      payload.clinicId!,
      parsed.data,
    );

    return NextResponse.json({ profile });
  } catch (err) {
    return handleRouteError("ehr/profile PATCH", err);
  }
}
