import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  forbidden,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Clinic from "@/lib/models/Clinic";
import { signToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { z } from "zod";
import { handleServiceError, readJson } from "@/lib/security/errors";

const setClinicSchema = z.object({
  clinicId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid clinic id"),
});

export async function PATCH(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  /**
   * admins never set clinicId this way
   * their clinicId is set when they create a clinic
   * doctors and receptionists can only set it once
   */
  if (payload.role === "admin") {
    return forbidden("Admins cannot set a clinic this way");
  }

  try {
    const body = await readJson(req);
    const parsed = setClinicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    await connectDB();

    const currentUser = await User.findById(payload.userId).select("clinicId");
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    /**
     * A clinician's clinic is assigned when they redeem an invite code
     * and is fixed from then on — it is the boundary every EHR read is
     * checked against, so a clinician who could re-point it would gain
     * access to another clinic's patient records.
     */
    if (
      (payload.role === "doctor" || payload.role === "receptionist") &&
      currentUser.clinicId
    ) {
      return forbidden(
        "Doctors and receptionists cannot change their clinic once set",
      );
    }

    const clinic = await Clinic.findOne({
      _id: parsed.data.clinicId,
      isActive: true,
    }).select("_id");

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const user = await User.findByIdAndUpdate(
      payload.userId,
      { clinicId: parsed.data.clinicId },
      { new: true },
    ).select("-password");

    // clinicId is a token claim used for authorization, so the session is
    // re-issued as an httpOnly cookie rather than returned to the client.
    const token = signToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      clinicId: parsed.data.clinicId,
    });

    return setSessionCookie(NextResponse.json({ user }), token);
  } catch (err) {
    return handleServiceError("users/clinic PATCH", err, 500);
  }
}
