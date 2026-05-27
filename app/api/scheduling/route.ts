/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { smartSchedule } from "@/lib/services/scheduling.service";
import { schedulingSchema } from "@/lib/validations/scheduling.schema";

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = schedulingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    const result = await smartSchedule({
      clinicId: parsed.data.clinicId,
      patientId: payload!.userId,
      message: parsed.data.message,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
