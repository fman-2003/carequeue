/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { z } from "zod";

const preferredDoctorSchema = z.object({
  preferredDoctorId: z.string().nullable(),
});

export async function PATCH(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["patient"]);
  if (roleError) return roleError;

  try {
    const body = await req.json();
    const parsed = preferredDoctorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findByIdAndUpdate(
      payload!.userId,
      { preferredDoctorId: parsed.data.preferredDoctorId },
      { new: true },
    ).select("-password");

    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
