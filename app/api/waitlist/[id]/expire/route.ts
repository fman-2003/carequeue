import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Waitlist from "@/lib/models/Waitlist";
import { triggerWaitlist } from "@/lib/services/waitlist.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;

  await connectDB();

  const entry = await Waitlist.findOne({
    _id: id,
    patientId: payload!.userId,
    status: "notified",
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Waitlist entry not found or already processed" },
      { status: 404 },
    );
  }

  // confirm the window has actually passed before expiring
  if (entry.expiresAt && new Date() < entry.expiresAt) {
    return NextResponse.json(
      { error: "Offer has not expired yet" },
      { status: 400 },
    );
  }

  await Waitlist.findByIdAndUpdate(id, { status: "expired" });

  // trigger next person
  await triggerWaitlist(
    entry.clinicId.toString(),
    entry.doctorId.toString(),
    entry.date,
    entry.timeSlot,
  );

  return NextResponse.json({ message: "Entry expired, next patient notified" });
}
