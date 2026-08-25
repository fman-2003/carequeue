import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  requireRole,
  requireClinic,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { handleServiceError } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["doctor"]);
  if (roleError) return roleError;

  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    await connectDB();

    const patients = await User.find({
      preferredDoctorId: payload.userId,
      role: "patient",
      // Scoped to the doctor's clinic as well: a patient at another
      // clinic who names this doctor should not appear in their list.
      clinicId,
    })
      .select("_id name email phone createdAt")
      .lean();

    return NextResponse.json({ patients });
  } catch (err) {
    return handleServiceError("doctors/my-patients GET", err, 500);
  }
}
