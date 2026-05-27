import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Waitlist from "@/lib/models/Waitlist";
import Appointment from "@/lib/models/Appointment";
import { triggerWaitlist } from "@/lib/services/waitlist.service";

export async function GET(req: NextRequest) {
  /**
   * Vercel Cron authenticates requests with a secret.
   * This prevents anyone from manually triggering the cron.
   */
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const now = new Date();

  /**
   * CLEANUP 1 — Expire notified entries past their 45 min window
   * Find all notified entries where expiresAt has passed
   */
  const expiredEntries = await Waitlist.find({
    status: "notified",
    expiresAt: { $lte: now },
  });

  for (const entry of expiredEntries) {
    await Waitlist.findByIdAndUpdate(entry._id, { status: "expired" });

    // trigger next person in line
    if (entry.doctorId && entry.offeredDate && entry.offeredTimeSlot) {
      await triggerWaitlist(
        entry.clinicId.toString(),
        entry.doctorId.toString(),
        entry.offeredDate,
        entry.offeredTimeSlot,
      );
    }
  }

  /**
   * CLEANUP 2 — Remove waitlist entries where
   * the linked appointment date has already passed.
   * Patient didn't get an earlier slot in time.
   */
  const passedAppointments = await Appointment.find({
    date: { $lte: now },
    status: { $in: ["confirmed", "completed", "no-show"] },
  })
    .select("_id")
    .lean();

  const passedIds = passedAppointments.map((a) => a._id);

  await Waitlist.updateMany(
    {
      appointmentId: { $in: passedIds },
      status: { $in: ["waiting", "notified"] },
    },
    { status: "removed" },
  );

  console.log(
    `Cron ran at ${now.toISOString()} — cleaned up expired and past waitlist entries`,
  );

  return NextResponse.json({ message: "Cleanup complete" });
}
