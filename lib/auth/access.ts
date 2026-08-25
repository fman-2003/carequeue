import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Appointment from "@/lib/models/Appointment";
import { TokenPayload } from "@/lib/auth/jwt";
import { isValidObjectId } from "@/lib/auth/middleware";

/**
 * Authorization for patient data.
 *
 * The EHR routes previously derived the target patient like this:
 *
 *   const patientId = role === "patient" ? userId : searchParams.get("patientId")
 *
 * which means *any* signed-in account that is not a patient could name
 * any patient id in the query string and read that person's medical
 * profile, visit history, and uploaded documents — across clinics, with
 * no relationship to the patient required. These helpers replace that
 * pattern: the caller states which patient it wants, and access is proven
 * before a record is read.
 *
 * The model applied is minimum necessary access:
 *   - a patient reaches their own records and nothing else;
 *   - a doctor reaches patients registered at the doctor's own clinic;
 *   - admins and receptionists run scheduling and administration, so they
 *     do not read clinical content at all.
 */

const CLINICAL_ROLES = ["doctor"];

type AccessResult =
  | { patientId: string; error: null }
  | { patientId: null; error: NextResponse };

const deny = (message: string, status: number): AccessResult => ({
  patientId: null,
  error: NextResponse.json({ error: message }, { status }),
});

/**
 * Resolves and authorizes the patient whose records are being requested.
 *
 * `requested` is whatever the caller supplied (query param, route
 * segment, or body field) and is treated as untrusted.
 */
export async function resolvePatientAccess(
  payload: TokenPayload,
  requested: unknown,
): Promise<AccessResult> {
  if (payload.role === "patient") {
    // A patient may only ever address their own record. Supplying someone
    // else's id is refused rather than silently ignored.
    if (requested !== undefined && requested !== null && requested !== "") {
      if (!isValidObjectId(requested) || requested !== payload.userId) {
        return deny("You can only access your own records", 403);
      }
    }
    return { patientId: payload.userId, error: null };
  }

  if (!CLINICAL_ROLES.includes(payload.role)) {
    return deny("You do not have permission to access patient records", 403);
  }

  if (!isValidObjectId(requested)) {
    return deny("A valid patientId is required", 400);
  }

  if (!payload.clinicId) {
    return deny("No clinic is associated with your account", 403);
  }

  await connectDB();

  /**
   * The clinic match is the actual authorization check: it proves the
   * patient is registered at the requesting doctor's clinic. Note that
   * `clinicId` is read from the verified token, never from the request.
   */
  const patient = await User.exists({
    _id: requested,
    role: "patient",
    clinicId: payload.clinicId,
  });

  if (!patient) {
    // Same response for "no such patient" and "not your patient", so the
    // endpoint cannot be used to test whether an id exists.
    return deny("Patient not found or not in your clinic", 404);
  }

  return { patientId: requested, error: null };
}

/**
 * Authorizes access to a single appointment.
 *
 * Returns the appointment only when the caller is a participant (the
 * patient or the assigned doctor) or staff at the clinic that owns it.
 */
export async function authorizeAppointment(
  payload: TokenPayload,
  appointmentId: unknown,
) {
  if (!isValidObjectId(appointmentId)) {
    return {
      appointment: null,
      error: NextResponse.json(
        { error: "A valid appointment id is required" },
        { status: 400 },
      ),
    };
  }

  await connectDB();

  const appointment = await Appointment.findById(appointmentId).lean<{
    _id: unknown;
    patientId: unknown;
    doctorId: unknown;
    clinicId: unknown;
  }>();

  const denied = {
    appointment: null,
    // One 404 for "does not exist" and "not yours" alike — a 403 here
    // would confirm that an appointment id is real.
    error: NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    ),
  };

  if (!appointment) return denied;

  const patientId = String(appointment.patientId);
  const doctorId = String(appointment.doctorId);
  const clinicId = String(appointment.clinicId);

  const allowed =
    (payload.role === "patient" && patientId === payload.userId) ||
    (payload.role === "doctor" && doctorId === payload.userId) ||
    ((payload.role === "receptionist" || payload.role === "admin") &&
      Boolean(payload.clinicId) &&
      clinicId === payload.clinicId);

  if (!allowed) return denied;

  return { appointment, error: null };
}
