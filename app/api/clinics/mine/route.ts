import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";
import { handleServiceError } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["admin"]);
  if (roleError) return roleError;

  try {
    await connectDB();

    // Matched on adminId from the session, so an admin only ever reads
    // their own clinic. Invite codes are excluded — they are issued and
    // listed through /api/clinics/invite, and each one is a credential.
    const clinic = await Clinic.findOne({ adminId: payload.userId })
      .select("-inviteCodes")
      .lean();

    // not finding a clinic is not an error here as
    // it only means the admin has not created a clinic yet
    return NextResponse.json({ clinic: clinic || null });
  } catch (err) {
    return handleServiceError("clinics/mine GET", err, 500);
  }
}
