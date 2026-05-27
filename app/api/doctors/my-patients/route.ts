import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["doctor"]);
  if (roleError) return roleError;

  await connectDB();

  const patients = await User.find({
    preferredDoctorId: payload!.userId,
    role: "patient",
  })
    .select("_id name email phone createdAt")
    .lean();

  return NextResponse.json({ patients });
}
