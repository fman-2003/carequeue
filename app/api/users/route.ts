import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireClinic } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { handleServiceError } from "@/lib/security/errors";

/**
 * Directory of doctors (and, for staff, patients) within the caller's
 * own clinic. Used to populate the booking form.
 */
export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  /**
   * This is the check that was missing. `User.find({ clinicId: undefined })`
   * is not "no users" — Mongoose strips undefined keys, leaving
   * `User.find({ role: "doctor" })`, which returns every doctor on the
   * platform. Since an admin account can be self-registered without a
   * clinic, that was a full directory dump for anyone who signed up.
   */
  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    await connectDB();

    if (payload.role === "patient") {
      const [doctors, patient] = await Promise.all([
        User.find({ clinicId, role: "doctor" })
          .select("_id name clinicId")
          .lean(),
        User.findOne({
          _id: payload.userId,
          clinicId,
          role: "patient",
        })
          .select("_id name")
          .lean(),
      ]);

      return NextResponse.json({
        doctors: doctors.map((d) => ({
          ...d,
          _id: String(d._id),
          clinicId: d.clinicId ? String(d.clinicId) : null,
        })),
        // A patient sees only themselves in the patient list.
        patient: patient ? [{ ...patient, _id: String(patient._id) }] : [],
      });
    }

    const [doctors, patients] = await Promise.all([
      User.find({ clinicId, role: "doctor" })
        .select("_id name clinicId")
        .lean(),
      User.find({ clinicId, role: "patient" }).select("_id name").lean(),
    ]);

    return NextResponse.json({
      doctors: doctors.map((d) => ({
        ...d,
        _id: String(d._id),
        clinicId: d.clinicId ? String(d.clinicId) : null,
      })),
      patients: patients.map((p) => ({ ...p, _id: String(p._id) })),
    });
  } catch (err) {
    return handleServiceError("users GET", err, 500);
  }
}
