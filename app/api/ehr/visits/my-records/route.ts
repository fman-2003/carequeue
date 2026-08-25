import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import VisitRecord from "@/lib/models/VisitRecord";
import { handleServiceError } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["patient"]);
  if (roleError) return roleError;

  try {
    await connectDB();

    // Scoped to the caller's own id from the verified session.
    const records = await VisitRecord.find({ patientId: payload.userId })
      .select(
        "appointmentId diagnosis prescriptions labTestsOrdered followUpDate referral createdAt",
      )
      .populate("doctorId", "name")
      .populate("appointmentId", "date timeSlot")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ records });
  } catch (err) {
    return handleServiceError("ehr/visits/my-records GET", err, 500);
  }
}
