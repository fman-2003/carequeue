import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  requireRole,
  requireClinic,
  isValidObjectId,
  badRequest,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Appointment from "@/lib/models/Appointment";
import Waitlist from "@/lib/models/Waitlist";
import { handleServiceError } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["admin"]);
  if (roleError) return roleError;

  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");

  if (!isValidObjectId(doctorId)) {
    return badRequest("A valid doctorId is required");
  }

  try {
    await connectDB();

    // The doctor must belong to this admin's clinic — otherwise the
    // endpoint reports on any doctor on the platform by id.
    const doctorInClinic = await User.exists({
      _id: doctorId,
      role: "doctor",
      clinicId,
    });

    if (!doctorInClinic) {
      return NextResponse.json(
        { error: "Doctor not found at your clinic" },
        { status: 404 },
      );
    }

    const [appointments, waitlistCount] = await Promise.all([
      Appointment.find({ doctorId, clinicId }).select("status").lean(),

      // Scoped to the clinic as well; the count previously spanned every
      // clinic this doctor might appear in.
      Waitlist.countDocuments({
        doctorId,
        clinicId,
        status: { $in: ["waiting", "notified"] },
      }),
    ]);

    const total = appointments.length;
    const completed = appointments.filter(
      (a) => a.status === "completed",
    ).length;
    const noShow = appointments.filter((a) => a.status === "no-show").length;
    const cancelled = appointments.filter(
      (a) => a.status === "cancelled",
    ).length;
    const pending = appointments.filter((a) => a.status === "pending").length;
    const closed = completed + noShow;

    return NextResponse.json({
      stats: {
        total,
        completed,
        noShow,
        cancelled,
        pending,
        waitlistCount,
        completionRate: closed > 0 ? Math.round((completed / closed) * 100) : 0,
        noShowRate: closed > 0 ? Math.round((noShow / closed) * 100) : 0,
      },
    });
  } catch (err) {
    return handleServiceError("admin/doctor-stats GET", err, 500);
  }
}
