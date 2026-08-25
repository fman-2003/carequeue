import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
  requireClinic,
} from "@/lib/auth/middleware";
import { resolvePatientAccess } from "@/lib/auth/access";
import { visitRecordSchema } from "@/lib/validations/ehr.schema";
import { getVisitRecords, createVisitRecord } from "@/lib/services/ehr.service";
import { handleServiceError, readJson } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);

  const access = await resolvePatientAccess(
    payload,
    searchParams.get("patientId"),
  );
  if (access.error) return access.error;

  try {
    const records = await getVisitRecords(access.patientId);
    return NextResponse.json({ records });
  } catch (err) {
    return handleServiceError("ehr/visits GET", err, 500);
  }
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  // only doctors can create visit records
  const roleError = requireRole(payload.role, ["doctor"]);
  if (roleError) return roleError;

  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    const body = await readJson(req);
    const parsed = visitRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // The record names a patient, so confirm that patient belongs to this
    // doctor's clinic before writing clinical notes against their id.
    const access = await resolvePatientAccess(payload, parsed.data.patientId);
    if (access.error) return access.error;

    const record = await createVisitRecord(
      parsed.data,
      payload.userId,
      clinicId,
    );

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return handleServiceError("ehr/visits POST", err, 400);
  }
}
