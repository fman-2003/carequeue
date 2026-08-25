import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
  requireClinic,
} from "@/lib/auth/middleware";
import { createAppointmentSchema } from "@/lib/validations/appointment.schema";
import {
  getAppointments,
  createAppointment,
} from "@/lib/services/appointment.service";
import VisitRecord from "@/lib/models/VisitRecord";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleServiceError, readJson } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { role, userId } = payload;

  /**
   * Every branch of getAppointments filters on clinicId. Mongoose drops
   * `undefined` keys from a filter, so a session with no clinic would
   * have produced `Appointment.find({})` — the whole appointment book of
   * every clinic on the platform. requireClinic makes that impossible.
   */
  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    const appointments = await getAppointments(clinicId, userId, role);

    if (role === "doctor") {
      const appointmentIds = appointments.map((a) => a._id);

      const visitRecords = await VisitRecord.find({
        appointmentId: { $in: appointmentIds },
        doctorId: userId,
      })
        .select("appointmentId")
        .lean<{ appointmentId: unknown }[]>();

      const visitRecordSet = new Set(
        visitRecords.map((v) => String(v.appointmentId)),
      );

      /**
       * Attach hasVisitRecord to each appointment.
       * This tells the frontend which button to show —
       * "Add Notes" or "View Notes"
       */
      const enriched = appointments.map((a) => ({
        ...a,
        hasVisitRecord: visitRecordSet.has(String(a._id)),
      }));

      return NextResponse.json({ appointments: enriched });
    }

    return NextResponse.json({ appointments });
  } catch (err) {
    return handleServiceError("appointments GET", err, 500);
  }
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, [
    "doctor",
    "receptionist",
    "patient",
  ]);
  if (roleError) return roleError;

  const limited = enforceRateLimit(
    req,
    "appointment-create",
    RATE_LIMITS.write,
    payload.userId,
  );
  if (limited) return limited;

  try {
    const body = await readJson(req);
    const parsed = createAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 422 },
      );
    }

    // The session, not the body, decides who may book for whom and at
    // which clinic — see createAppointment.
    const appointment = await createAppointment(parsed.data, payload);
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    return handleServiceError("appointments POST", err, 400);
  }
}
