import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { resolvePatientAccess } from "@/lib/auth/access";
import { connectDB } from "@/lib/db";
import MedicalProfile from "@/lib/models/MedicalProfile";
import User from "@/lib/models/User";
import { handleServiceError } from "@/lib/security/errors";

type Params = { params: Promise<{ patientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { patientId } = await params;

  // Validates the id and proves the patient belongs to this clinician's
  // clinic before any record is read.
  const access = await resolvePatientAccess(payload, patientId);
  if (access.error) return access.error;

  try {
    await connectDB();

    const [patient, profile] = await Promise.all([
      User.findById(access.patientId).select("name email phone").lean(),
      MedicalProfile.findOne({ patientId: access.patientId }).lean(),
    ]);

    return NextResponse.json({ patient, profile });
  } catch (err) {
    return handleServiceError("ehr/patients/[patientId]/profile", err, 500);
  }
}
