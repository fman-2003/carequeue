import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
  requireClinic,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Waitlist from "@/lib/models/Waitlist";
import { joinWaitlistSchema } from "@/lib/validations/waitlist.schema";
import { joinWaitlist } from "@/lib/services/waitlist.service";
import { handleServiceError, readJson } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  /**
   * The filter is clinic-scoped, and an undefined clinicId would be
   * dropped by Mongoose — returning every waitlist entry on the platform,
   * populated with each patient's name and phone number.
   */
  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    await connectDB();

    const filter: Record<string, unknown> = {
      clinicId,
      status: { $in: ["waiting", "notified"] },
    };

    if (payload.role === "patient") {
      filter.patientId = payload.userId;
    }

    const waitlist = await Waitlist.find(filter)
      // Doctors and front-desk staff need the contact number to call the
      // patient; a patient viewing their own entry does not need anyone
      // else's, and the filter above already limits them to their own.
      .populate("patientId", "name phone")
      .populate("doctorId", "name")
      .sort({ position: 1 })
      .lean();

    return NextResponse.json({ waitlist });
  } catch (err) {
    return handleServiceError("waitlist GET", err, 500);
  }
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["patient"]);
  if (roleError) return roleError;

  try {
    const body = await readJson(req);
    const parsed = joinWaitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    // joinWaitlist matches the appointment on patientId, so a patient can
    // only queue against an appointment that is theirs.
    const entry = await joinWaitlist(parsed.data.appointmentId, payload.userId);

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return handleServiceError("waitlist POST", err, 400);
  }
}
