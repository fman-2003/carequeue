import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { resolvePatientAccess } from "@/lib/auth/access";
import { connectDB } from "@/lib/db";
import VisitRecord from "@/lib/models/VisitRecord";
import User from "@/lib/models/User";
import { handleServiceError } from "@/lib/security/errors";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { patientId } = await params;

  const access = await resolvePatientAccess(payload, patientId);
  if (access.error) return access.error;

  try {
    await connectDB();

    const [patient, records] = await Promise.all([
      // Only the fields the chart header needs — not the whole user
      // document, which carries the password hash field definition,
      // clinic linkage, and verification state.
      User.findById(access.patientId).select("name email phone").lean(),
      VisitRecord.find({ patientId: access.patientId })
        .populate("appointmentId", "date timeSlot")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return NextResponse.json({ records, patient });
  } catch (err) {
    return handleServiceError("ehr/patients/[patientId]/visits", err, 500);
  }
}
