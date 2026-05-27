/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { trainModel } from "@/lib/services/prediction.service";

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  // only admins can trigger training
  const roleError = requireRole(payload!.role, ["admin"]);
  if (roleError) return roleError;

  try {
    const result = await trainModel();

    if (!result) {
      return NextResponse.json(
        {
          error:
            "Not enough data to train. Need at least 50 completed appointments.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "Model trained successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
