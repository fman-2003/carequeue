import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";
import { handleServiceError } from "@/lib/security/errors";

/**
 * Public clinic directory, used by patients choosing where to register.
 * The projection is deliberately narrow — name and location only, never
 * the admin's identity or the clinic's invite codes.
 */
export async function GET(req: NextRequest) {
  const { error } = authenticate(req);
  if (error) return error;

  try {
    await connectDB();

    const clinics = await Clinic.find({ isActive: true })
      .select("_id name address state lga")
      .lean();

    return NextResponse.json({ clinics });
  } catch (err) {
    return handleServiceError("clinics/all GET", err, 500);
  }
}
