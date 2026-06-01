/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Waitlist from "@/lib/models/Waitlist";
import { joinWaitlistSchema } from "@/lib/validations/waitlist.schema";
import { joinWaitlist } from "@/lib/services/waitlist.service";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    await connectDB();

    const filter: Record<string, any> = {
      clinicId: payload?.clinicId,
      status: { $in: ["waiting", "notified"] },
    };

    if (payload!.role === "patient") {
      filter.patientId = payload!.userId;
    }

    const waitlist = await Waitlist.find(filter)
      .populate("patientId", "name phone")
      .populate("doctorId", "name")
      .sort({ position: 1 })
      .lean();

    return NextResponse.json({ waitlist });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["patient"]);
  if (roleError) return roleError;

  try {
    const body = await req.json();
    const parsed = joinWaitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    const entry = await joinWaitlist(
      parsed.data.appointmentId,
      payload!.userId,
    );

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
