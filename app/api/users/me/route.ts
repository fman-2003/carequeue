import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  if (!payload?.userId) {
    return NextResponse.json(
      { error: "Invalid token payload" },
      { status: 400 },
    );
  }

  await connectDB();

  const user = await User.findById(payload!.userId)
    .select("-password")
    .populate("preferredDoctorId", "name email phone")
    .lean();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
