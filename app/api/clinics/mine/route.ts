import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["admin"]);
  if (roleError) return roleError;

  await connectDB();

  const clinic = await Clinic.findOne({ adminId: payload!.userId }).lean();

  // not finding a clinic is not an error here as
  // it only means the admin has not created a clinic yet
  // so no need to return an error
  return NextResponse.json({ clinic: clinic || null });
}
