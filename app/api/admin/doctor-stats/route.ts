import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Appointment from "@/lib/models/Appointment";
import Waitlist from "@/lib/models/Waitlist";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["admin"]);
  if (roleError) return roleError;

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");

  if (!doctorId) {
    return NextResponse.json(
      { error: "doctorId is required" },
      { status: 400 },
    );
  }

  await connectDB();

  const [appointments, waitlistCount] = await Promise.all([
    Appointment.find({
      doctorId,
      clinicId: payload!.clinicId,
    })
      .select("status")
      .lean(),

    Waitlist.countDocuments({
      doctorId,
      status: { $in: ["waiting", "notified"] },
    }),
  ]);

  const total = appointments.length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const noShow = appointments.filter((a) => a.status === "no-show").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
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
}
