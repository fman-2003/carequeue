/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import {
  getVisitRecordByAppointment,
  updateVisitRecord,
} from "@/lib/services/ehr.service";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { error } = authenticate(req);
  if (error) return error;

  const { appointmentId } = await params;

  try {
    const record = await getVisitRecordByAppointment(appointmentId);
    return NextResponse.json({ record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["doctor"]);
  if (roleError) return roleError;

  const { appointmentId } = await params;

  try {
    const body = await req.json();
    const record = await updateVisitRecord(
      appointmentId,
      payload!.userId,
      body,
    );
    return NextResponse.json({ record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
