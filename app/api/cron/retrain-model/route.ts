import { NextRequest, NextResponse } from "next/server";
import { trainModel } from "@/lib/services/prediction.service";
import { safeCompare } from "@/lib/security/secrets";
import { handleRouteError } from "@/lib/security/errors";

/**
 * Weekly retrain.
 *
 * Nothing retrained the model before this: it could only be built by an
 * admin pressing a button, and the result lived in one process's memory.
 * A scheduled run keeps the stored model current as more appointments
 * close, which is the whole premise of the feature — the model is
 * supposed to get better as the clinic accumulates history.
 */

// Training is CPU-bound and runs for longer than a normal request. Vercel
// reads this from the build output; the ceiling depends on the plan
// (60s on Hobby, up to 300s on Pro).
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[cron/retrain-model] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Constant-time comparison, and it fails closed when the secret is
  // missing rather than matching the literal "Bearer undefined".
  const authHeader = req.headers.get("authorization") ?? "";
  if (!safeCompare(authHeader, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await trainModel();

    if (!result) {
      // Not an error: a young clinic simply has no history yet.
      return NextResponse.json({
        message: "Skipped — not enough closed appointments to train yet",
        trained: false,
      });
    }

    return NextResponse.json({
      message: "Model retrained",
      trained: true,
      ...result,
    });
  } catch (err) {
    return handleRouteError("cron/retrain-model", err);
  }
}
