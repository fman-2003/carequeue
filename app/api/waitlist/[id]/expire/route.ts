import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  isValidObjectId,
  badRequest,
  notFound,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Waitlist from "@/lib/models/Waitlist";
import { triggerWaitlist } from "@/lib/services/waitlist.service";
import { handleServiceError } from "@/lib/security/errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;
  if (!isValidObjectId(id)) return badRequest("Invalid waitlist entry id");

  try {
    await connectDB();

    const entry = await Waitlist.findOne({
      _id: id,
      patientId: payload.userId,
      status: "notified",
    });

    if (!entry) {
      return notFound("Waitlist entry not found or already processed");
    }

    // confirm the window has actually passed before expiring
    if (entry.expiresAt && new Date() < entry.expiresAt) {
      return badRequest("Offer has not expired yet");
    }

    /**
     * Conditional update rather than a blind write: two requests racing
     * on the same entry would otherwise both flip it to expired and both
     * call triggerWaitlist, offering one slot to two patients.
     */
    const expired = await Waitlist.findOneAndUpdate(
      { _id: id, patientId: payload.userId, status: "notified" },
      { status: "expired" },
    );

    if (!expired) {
      return notFound("Waitlist entry not found or already processed");
    }

    // trigger next person
    await triggerWaitlist(
      entry.clinicId.toString(),
      entry.doctorId.toString(),
      entry.date,
      entry.timeSlot,
    );

    return NextResponse.json({
      message: "Entry expired, next patient notified",
    });
  } catch (err) {
    return handleServiceError("waitlist/[id]/expire POST", err, 500);
  }
}
