/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { signupSchema } from "@/lib/validations/auth.schema";
import { signupUser } from "@/lib/services/auth.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // validate user input before it hits db
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 422 },
      );
    }

    const result = await signupUser(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
