import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
  requireClinic,
} from "@/lib/auth/middleware";
import {
  trainModel,
  MIN_TRAINING_ROWS,
} from "@/lib/services/prediction.service";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { handleRouteError } from "@/lib/security/errors";

// Training runs longer than a normal request; see the retrain cron.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  // only admins can trigger training
  const roleError = requireRole(payload.role, ["admin"]);
  if (roleError) return roleError;

  const { error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  /**
   * Training walks the whole appointment history and fits a model. It is
   * the most expensive operation in the app, so it is capped tightly —
   * otherwise one admin account can pin the server by holding the button.
   */
  const limited = enforceRateLimit(
    req,
    "model-train",
    { limit: 2, windowMs: 60 * 60 * 1000 },
    payload.userId,
  );
  if (limited) return limited;

  try {
    const result = await trainModel();

    if (!result) {
      return NextResponse.json(
        {
          error: `Not enough data to train. Need at least ${MIN_TRAINING_ROWS} completed or no-show appointments.`,
        },
        { status: 400 },
      );
    }

    /**
     * The evaluation numbers come back to the caller so an admin can see
     * whether the model is actually usable. Accuracy on its own hides a
     * model that never predicts a no-show, which is why precision and
     * recall are reported alongside it.
     */
    return NextResponse.json({
      message: "Model trained successfully",
      sampleCount: result.sampleCount,
      noShowRate: Math.round(result.positiveRate * 1000) / 1000,
      threshold: result.threshold,
      metrics: {
        precision: Math.round(result.metrics.precision * 1000) / 1000,
        recall: Math.round(result.metrics.recall * 1000) / 1000,
        f1: Math.round(result.metrics.f1 * 1000) / 1000,
        auc: Math.round(result.metrics.auc * 1000) / 1000,
        accuracy: Math.round(result.metrics.accuracy * 1000) / 1000,
      },
    });
  } catch (err) {
    return handleRouteError("admin/train", err);
  }
}
