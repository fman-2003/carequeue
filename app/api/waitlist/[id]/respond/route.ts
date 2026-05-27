/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { respondToWaitlistSchema } from "@/lib/validations/waitlist.schema";
import { respondToWaitlist } from "@/lib/services/waitlist.service";

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = respondToWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    const result = await respondToWaitlist(
      id,
      payload!.userId,
      parsed.data.response,
    );
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
