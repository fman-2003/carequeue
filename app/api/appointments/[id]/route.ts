import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  forbidden,
} from "@/lib/auth/middleware";
import { authorizeAppointment } from "@/lib/auth/access";
import { updateAppointmentSchema } from "@/lib/validations/appointment.schema";
import {
  getAppointment,
  updateAppointment,
} from "@/lib/services/appointment.service";
import { handleServiceError, readJson } from "@/lib/security/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;

  /**
   * Any signed-in account could previously read any appointment by id,
   * which exposed the patient's and doctor's name, email, and phone.
   * Access is now limited to the two participants and the staff of the
   * clinic that owns the appointment.
   */
  const { error: accessError } = await authorizeAppointment(payload, id);
  if (accessError) return accessError;

  try {
    const appointment = await getAppointment(id);
    return NextResponse.json({ appointment });
  } catch (err) {
    return handleServiceError("appointments/[id] GET", err, 404);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;

  /**
   * The previous handler checked roles but never checked *whose*
   * appointment this was, so any patient could cancel a stranger's
   * appointment and any doctor could mark someone else's as completed —
   * which then fires WhatsApp notifications to those people.
   */
  const { appointment, error: accessError } = await authorizeAppointment(
    payload,
    id,
  );
  if (accessError) return accessError;

  if (payload.role === "admin") {
    return forbidden("Admins cannot modify appointments");
  }

  try {
    const body = await readJson(req);
    const parsed = updateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    if (payload.role === "patient") {
      // A patient may cancel their own appointment. Nothing else — in
      // particular not marking it "completed", which is what unlocks the
      // clinical record for that visit.
      const onlyStatusChange =
        Object.keys(parsed.data).length === 1 && parsed.data.status;

      if (!onlyStatusChange || parsed.data.status !== "cancelled") {
        return forbidden("Patients can only cancel their own appointments");
      }
    }

    if (payload.role === "receptionist") {
      // Front desk schedules and cancels; clinical outcomes are the
      // doctor's to record.
      if (
        parsed.data.status === "completed" ||
        parsed.data.status === "no-show"
      ) {
        return forbidden(
          "Only the attending doctor can close out an appointment",
        );
      }
    }

    const updated = await updateAppointment(
      String(appointment._id),
      parsed.data,
    );
    return NextResponse.json({ appointment: updated });
  } catch (err) {
    return handleServiceError("appointments/[id] PATCH", err, 400);
  }
}
