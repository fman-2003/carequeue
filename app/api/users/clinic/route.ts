/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Clinic from "@/lib/models/Clinic";
import { signToken } from "@/lib/auth/jwt";
import { z } from "zod";

const setClinicSchema = z.object({
  clinicId: z.string().min(1, "Clinic is required"),
});

export async function PATCH(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  /**
   * admins never set clinicId this way
   * their clinicId is set when they create a clinic
   * doctors and receptionists can only set it once
   */
  if (payload!.role === "admin") {
    return NextResponse.json(
      { error: "Admins cannot set a clinic this way" },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const parsed = setClinicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await connectDB();

    const currentUser = await User.findById(payload!.userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      (payload!.role === "doctor" || payload!.role === "receptionist") &&
      currentUser.clinicId
    ) {
      return NextResponse.json(
        {
          error:
            "Doctors and receptionists cannot change their clinic once set",
        },
        { status: 403 },
      );
    }

    const clinic = await Clinic.findById(parsed.data.clinicId);
    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const user = await User.findByIdAndUpdate(
      payload!.userId,
      { clinicId: parsed.data.clinicId },
      { new: true },
    ).select("-password");
    const newToken = signToken({
      userId: payload!.userId,
      email: payload!.email,
      role: payload!.role,
      clinicId: parsed.data.clinicId,
    });

    return NextResponse.json({ user, token: newToken });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
