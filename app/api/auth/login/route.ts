/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations/auth.schema";
import { loginUser } from "@/lib/services/auth.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 422 },
      );
    }

    const result = await loginUser(parsed.data);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
