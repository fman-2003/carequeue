import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
  isValidObjectId,
  badRequest,
} from "@/lib/auth/middleware";
import { respondToWaitlistSchema } from "@/lib/validations/waitlist.schema";
import { respondToWaitlist } from "@/lib/services/waitlist.service";
import { handleServiceError, readJson } from "@/lib/security/errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  // Accepting or declining a slot offer belongs to the patient it was
  // offered to; staff have their own scheduling routes.
  const roleError = requireRole(payload.role, ["patient"]);
  if (roleError) return roleError;

  const { id } = await params;
  if (!isValidObjectId(id)) return badRequest("Invalid waitlist entry id");

  try {
    const body = await readJson(req);
    const parsed = respondToWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    // respondToWaitlist matches on { _id, patientId }, so the entry must
    // belong to the caller.
    const result = await respondToWaitlist(
      id,
      payload.userId,
      parsed.data.response,
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError("waitlist/[id]/respond POST", err, 400);
  }
}
