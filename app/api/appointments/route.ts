/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { createAppointmentSchema } from "@/lib/validations/appointment.schema";
import {
  getAppointments,
  createAppointment,
} from "@/lib/services/appointment.service";

export async function GET(req: NextRequest) {
  // check if user logged in
  const { payload, error } = authenticate(req);
  if (error) return error;

  // console.log("payload:", payload);
  // get clinicId from token payload that was set during login
  const { role, clinicId, userId } = payload;
  if (!clinicId)
    return NextResponse.json({ error: "Clinic not found" }, { status: 400 });

  try {
    const appointments = await getAppointments(clinicId, userId, role);
    return NextResponse.json({ appointments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, [
    "doctor",
    "receptionist",
    "patient",
  ]);
  if (roleError) return roleError;

  try {
    const body = await req.json();
    const parsed = createAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 422 },
      );
    }

    const appointment = await createAppointment(parsed.data, payload!.role);
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
