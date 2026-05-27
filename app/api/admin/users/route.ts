/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["admin"]);
  if (roleError) return roleError;

  await connectDB();
  try {
    const [doctors, patients] = await Promise.all([
      User.find({ clinicId: payload?.clinicId, role: "doctor" })
        .select("_id name email phone role createdAt")
        .lean(),
      User.find({ clinicId: payload?.clinicId, role: "patient" })
        .select("_id name email phone role createdAt preferredDoctorId")
        .lean(),
    ]);
    return NextResponse.json({ doctors, patients });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
