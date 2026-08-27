import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Waitlist from "@/lib/models/Waitlist";
import Appointment from "@/lib/models/Appointment";
import { triggerWaitlist } from "@/lib/services/waitlist.service";
import { safeCompare } from "@/lib/security/secrets";
import { handleRouteError } from "@/lib/security/errors";

export async function GET(req: NextRequest) {
  /**
   * Vercel Cron authenticates with a shared secret.
   *
   * Two problems with the previous check. It interpolated the secret into
   * a template string, so if CRON_SECRET was unset the expected header
   * became the literal "Bearer undefined" — which anyone can send. And
   * `!==` on strings returns as soon as bytes differ, leaking the secret
   * a byte at a time to a patient attacker.
   */
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[cron/cleanup-waitlist] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization") ?? "";

  if (!safeCompare(authHeader, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
      `[cron/cleanup-waitlist] ran at ${now.toISOString()} — expired ${expiredEntries.length} entries`,
    );

    return NextResponse.json({ message: "Cleanup complete" });
  } catch (err) {
    return handleRouteError("cron/cleanup-waitlist", err);
  }
}
