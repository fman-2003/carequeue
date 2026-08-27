import { NextRequest, NextResponse } from "next/server";
import { authenticate, assertSameOrigin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { z } from "zod";
import { signToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { validateAvatar } from "@/lib/security/fileValidation";
import { uploadAvatar } from "@/lib/services/storage.service";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleServiceError, readJson } from "@/lib/security/errors";

const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100)
      .optional(),
    email: z.email("Invalid email").max(254).toLowerCase().trim().optional(),
    // Was an unvalidated free-text field, which meant anything could be
    // written to the column the WhatsApp webhook uses to identify a user.
    phone: z
      .string()
      .trim()
      .regex(
        /^(\+234|0)[789][01]\d{8}$/,
        "Invalid phone number (Use nigerian format)",
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    await connectDB();

    const user = await User.findById(payload.userId)
      .select("-password")
      .populate("preferredDoctorId", "name email")
      .populate("clinicId", "name")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    return handleServiceError("users/profile GET", err, 500);
  }
}

export async function PATCH(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const limited = enforceRateLimit(
        req,
        "avatar-upload",
        RATE_LIMITS.upload,
        payload.userId,
      );
      if (limited) return limited;

      /**
       * The declared MIME type was the only check before. It comes from
       * the browser, so an attacker could label any payload `image/png`.
       * validateAvatar re-reads the file signature and rejects anything
       * whose bytes disagree.
       */
      const file = await validateAvatar(
        (await req.formData()).get("profilePicture"),
      );

      const stored = await uploadAvatar(file.buffer, {
        userId: payload.userId,
        kind: file.kind,
      });

      await connectDB();
      const user = await User.findByIdAndUpdate(
        payload.userId,
        { profilePicture: stored.url },
        { new: true },
      ).select("-password");

      return NextResponse.json({ user });
    }

    // JSON update — name, email, phone
    const body = await readJson(req);
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await connectDB();

    /**
     * Only these three fields reach the update. The schema strips
     * everything else, so role, clinicId, isVerified, and password stay
     * out of reach of a profile edit.
     */
    const update: Record<string, string> = {};
    if (parsed.data.name) update.name = parsed.data.name;
    if (parsed.data.email) update.email = parsed.data.email;
    if (parsed.data.phone) update.phone = parsed.data.phone;

    const user = await User.findByIdAndUpdate(
      payload.userId,
      { $set: update },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // The email is a token claim, so changing it re-issues the session
    // cookie rather than handing a token back to client script.
    if (parsed.data.email && parsed.data.email !== payload.email) {
      const token = signToken({
        userId: payload.userId,
        email: parsed.data.email,
        role: payload.role,
        clinicId: payload.clinicId,
      });

      return setSessionCookie(NextResponse.json({ user }), token);
    }

    return NextResponse.json({ user });
  } catch (err) {
    // A duplicate email or phone surfaces as a driver error; report it as
    // a conflict instead of leaking the index name.
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "That email or phone number is already in use" },
        { status: 409 },
      );
    }
    return handleServiceError("users/profile PATCH", err, 500);
  }
}
