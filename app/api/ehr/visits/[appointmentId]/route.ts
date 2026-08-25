import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
} from "@/lib/auth/middleware";
import { authorizeAppointment } from "@/lib/auth/access";
import { updateVisitRecordSchema } from "@/lib/validations/ehr.schema";
import {
  getVisitRecordByAppointment,
  updateVisitRecord,
} from "@/lib/services/ehr.service";
import { handleServiceError, readJson } from "@/lib/security/errors";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { appointmentId } = await params;

  /**
   * This route used to return any visit record to any signed-in account
   * that could name an appointment id — the whole clinical note,
   * including diagnosis and prescriptions. Access is now tied to being a
   * participant in that appointment.
   */
  const { error: accessError } = await authorizeAppointment(
    payload,
    appointmentId,
  );
  if (accessError) return accessError;

  // Clinical notes are for the patient and their doctor, not for
  // front-desk or administrative accounts.
  const roleError = requireRole(payload.role, ["doctor", "patient"]);
  if (roleError) return roleError;

  try {
    const record = await getVisitRecordByAppointment(appointmentId);
    return NextResponse.json({ record });
  } catch (err) {
    return handleServiceError("ehr/visits/[appointmentId] GET", err, 404);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["doctor"]);
  if (roleError) return roleError;

  const { appointmentId } = await params;

  const { error: accessError } = await authorizeAppointment(
    payload,
    appointmentId,
  );
  if (accessError) return accessError;

  try {
    const body = await readJson(req);

    /**
     * The body used to be forwarded into `$set` unvalidated, so a request
     * could rewrite patientId, doctorId, or clinicId on an existing
     * record and move a clinical note onto someone else's chart. Only the
     * clinical fields are accepted now.
     */
    const parsed = updateVisitRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const record = await updateVisitRecord(
      appointmentId,
      payload.userId,
      parsed.data,
    );
    return NextResponse.json({ record });
  } catch (err) {
    return handleServiceError("ehr/visits/[appointmentId] PATCH", err, 400);
  }
}
