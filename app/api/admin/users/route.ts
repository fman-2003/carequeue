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

  const roleError = requireRole(payload.role, ["admin"]);
  if (roleError) return roleError;

  /**
   * An admin account can exist before it has created a clinic. Without
   * this guard the queries below became unfiltered by clinic — Mongoose
   * drops `undefined` from a filter — and returned the name, email, and
   * phone of every doctor and every patient on the platform to anyone who
   * signed up as an admin.
   */
  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    await connectDB();

    const [doctors, patients] = await Promise.all([
      User.find({ clinicId, role: "doctor" })
        .select("_id name email phone role createdAt")
        .lean(),
      User.find({ clinicId, role: "patient" })
        .select("_id name email phone role createdAt preferredDoctorId")
        .lean(),
    ]);

    return NextResponse.json({ doctors, patients });
  } catch (err) {
    return handleServiceError("admin/users GET", err, 500);
  }
}
