/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { updateAppointmentSchema } from "@/lib/validations/appointment.schema";
import {
  getAppointment,
  updateAppointment,
  // deleteAppointment,
} from "@/lib/services/appointment.service";

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { error } = authenticate(req);
  if (error) return error;
  const { id } = await params;

  try {
    const appointment = await getAppointment(id);
    return NextResponse.json({ appointment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    if (payload!.role === "admin") {
      return NextResponse.json(
        { error: "Admins cannot modify appointments" },
        { status: 403 },
      );
    }

    if (
      payload!.role === "patient" &&
      parsed.data.status &&
      parsed.data.status !== "cancelled"
    ) {
      return NextResponse.json(
        { error: "Patients can only cancel appointments" },
        { status: 403 },
      );
    }

    const appointment = await updateAppointment(
      id,
      parsed.data,
    );
    return NextResponse.json({ appointment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}