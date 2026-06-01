// app/api/ehr/patients/[patientId]/visits/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import VisitRecord from "@/lib/models/VisitRecord";
import User from "@/lib/models/User";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["doctor"]);
  if (roleError) return roleError;

  const { patientId } = await params;

  await connectDB();

  const patient = await User.findOne({
    _id: patientId,
    clinicId: payload!.clinicId,
    role: "patient",
  }).lean();

  if (!patient) {
    return NextResponse.json(
      { error: "Patient not found or not in your clinic" },
      { status: 404 },
    );
  }

  const records = await VisitRecord.find({ patientId })
    .populate("appointmentId", "date timeSlot")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ records, patient });
}
