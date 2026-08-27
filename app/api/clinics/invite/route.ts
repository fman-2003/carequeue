import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireRole,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";
import crypto from "crypto";
import { z } from "zod";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleServiceError, readJson } from "@/lib/security/errors";

const inviteSchema = z.object({
  role: z.enum(["doctor", "receptionist"], {
    message: "Only doctor or receptionist codes can be generated.",
  }),
});

/**
 * An invite code grants a clinician account at a clinic — a doctor code
 * is effectively read access to every patient record there. Codes are
 * generated with a CSPRNG, single-use (claimed atomically at signup), and
 * expire so an old unused code cannot be redeemed months later.
 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["admin"]);
  if (roleError) return roleError;

  const limited = enforceRateLimit(
    req,
    "invite",
    RATE_LIMITS.invite,
    payload.userId,
  );
  if (limited) return limited;

  try {
    // Was `const { role } = await req.json()`, so a malformed body threw
    // an unhandled error and returned a 500.
    const body = await readJson(req);
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    await connectDB();

    // 12 random bytes -> 96 bits of entropy, well past guessing range.
    const code = "CQ-" + crypto.randomBytes(12).toString("hex").toUpperCase();

    const clinic = await Clinic.findOneAndUpdate(
      { adminId: payload.userId },
      {
        $push: {
          inviteCodes: {
            code,
            role: parsed.data.role,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          },
        },
      },
      { returnDocument: "after" },
    );

    if (!clinic) {
      return NextResponse.json(
        { error: "Clinic not found. Create your clinic first." },
        { status: 404 },
      );
    }

    return NextResponse.json({ code, role: parsed.data.role });
  } catch (err) {
    return handleServiceError("clinics/invite POST", err, 500);
  }
}

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload.role, ["admin"]);
  if (roleError) return roleError;

  try {
    await connectDB();

    // Scoped to the clinic this admin owns, so one admin cannot read
    // another clinic's live invite codes.
    const clinic = await Clinic.findOne({ adminId: payload.userId })
      .select("inviteCodes")
      .lean<{ inviteCodes?: unknown[] }>();

    return NextResponse.json({ codes: clinic?.inviteCodes ?? [] });
  } catch (err) {
    return handleServiceError("clinics/invite GET", err, 500);
  }
}
