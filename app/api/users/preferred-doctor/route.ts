import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
  requireClinic,
  isValidObjectId,
  badRequest,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { z } from "zod";
import { handleServiceError, readJson } from "@/lib/security/errors";

const preferredDoctorSchema = z.object({
  preferredDoctorId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid doctor id")
    .nullable(),
});

export async function PATCH(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["patient"]);
  if (roleError) return roleError;

  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    const body = await readJson(req);
    const parsed = preferredDoctorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    await connectDB();

    const { preferredDoctorId } = parsed.data;

    /**
     * The id used to be written straight to the user document with no
     * check that it referred to a doctor at all. Since /api/doctors/my-patients
     * lists every patient who names you as their preferred doctor, an
     * arbitrary id there hands that account a patient list it should not
     * have — and pointing it at another patient exposes them the same way.
     */
    if (preferredDoctorId !== null) {
      if (!isValidObjectId(preferredDoctorId)) {
        return badRequest("Invalid doctor id");
      }

      const doctorInClinic = await User.exists({
        _id: preferredDoctorId,
        role: "doctor",
        clinicId,
      });

      if (!doctorInClinic) {
        return NextResponse.json(
          { error: "Doctor not found at your clinic" },
          { status: 404 },
        );
      }
    }

    const user = await User.findByIdAndUpdate(
      payload.userId,
      { preferredDoctorId },
      { new: true },
    ).select("-password");

    return NextResponse.json({ user });
  } catch (err) {
    return handleServiceError("users/preferred-doctor PATCH", err, 400);
  }
}
