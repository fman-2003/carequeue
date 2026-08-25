import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Clinic from "@/lib/models/Clinic";
import { signToken } from "@/lib/auth/jwt";
import { AppError } from "@/lib/security/errors";
import { SignupInput, LoginInput } from "@/lib/validations/auth.schema";

/**
 * A pre-computed hash used to burn the same CPU time as a real password
 * comparison when the account does not exist. Without it, a missing
 * account returns noticeably faster than a wrong password, which turns
 * the login endpoint into a user-enumeration oracle.
 */
const DUMMY_HASH = bcrypt.hashSync("carequeue-timing-equaliser", 12);

export async function signupUser(data: SignupInput) {
  await connectDB();

  let assignedClinicId: string | undefined;

  if (data.role === "doctor" || data.role === "receptionist") {
    if (!data.inviteCode) {
      throw new AppError(
        "Doctors and receptionists must have an invite code from their clinic admin. Contact your clinic admin to get one.",
        422,
      );
    }

    /**
     * Claim the invite code atomically.
     *
     * The previous flow read the code, created the user, then marked the
     * code used. Two signups racing on the same code both passed the read
     * and both got a clinician account. A single findOneAndUpdate that
     * matches on `isUsed: false` and flips it in the same operation means
     * exactly one request can win.
     *
     * The role is matched here too, so a receptionist code cannot be
     * redeemed for a doctor account (doctors can read every patient
     * record in the clinic).
     */
    const now = new Date();

    // Codes issued before expiry was introduced have no expiresAt and
    // stay valid; new ones must still be inside their window.
    const unexpired = { $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }] };

    const clinic = await Clinic.findOneAndUpdate(
      {
        inviteCodes: {
          $elemMatch: {
            code: data.inviteCode,
            isUsed: false,
            role: data.role,
            ...unexpired,
          },
        },
      },
      { $set: { "inviteCodes.$[elem].isUsed": true } },
      {
        arrayFilters: [
          {
            "elem.code": data.inviteCode,
            "elem.isUsed": false,
            "elem.role": data.role,
            $or: [{ "elem.expiresAt": { $gt: now } }, { "elem.expiresAt": null }],
          },
        ],
        new: true,
      },
    );

    if (!clinic) {
      // Deliberately one message for "no such code", "already used", and
      // "wrong role" — otherwise the endpoint confirms which codes exist.
      throw new AppError(
        "Invalid or already used invite code. Contact your clinic admin.",
        422,
      );
    }

    assignedClinicId = clinic._id.toString();
  }

  try {
    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone,
      // Explicit field list rather than a spread: a spread hands every
      // key in the request body to the model, so any field added to the
      // schema later (isVerified, clinicId...) becomes settable at signup.
      role: data.role,
      clinicId: assignedClinicId ?? null,
    });

    // Link the redeemed code to the account that used it.
    if (assignedClinicId && data.inviteCode) {
      await Clinic.findByIdAndUpdate(
        assignedClinicId,
        { $set: { "inviteCodes.$[elem].usedBy": user._id } },
        { arrayFilters: [{ "elem.code": data.inviteCode }] },
      );
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      clinicId: user.clinicId?.toString(),
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId?.toString() ?? null,
      },
    };
  } catch (err: unknown) {
    // Release the invite code if account creation failed, otherwise a
    // duplicate-email attempt permanently consumes a valid code.
    if (assignedClinicId && data.inviteCode) {
      await Clinic.findByIdAndUpdate(
        assignedClinicId,
        { $set: { "inviteCodes.$[elem].isUsed": false } },
        { arrayFilters: [{ "elem.code": data.inviteCode }] },
      ).catch(() => undefined);
    }

    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: number }).code === 11000
    ) {
      throw new AppError("Email or phone number already in use", 409);
    }

    throw err;
  }
}

export async function loginUser(data: LoginInput) {
  await connectDB();

  const user = await User.findOne({ email: data.email }).select("+password");

  if (!user) {
    // Compare against a throwaway hash so the response time matches the
    // "wrong password" path, then fail with the identical message.
    await bcrypt.compare(data.password, DUMMY_HASH);
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await user.comparePassword(data.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    clinicId: user.clinicId?.toString(),
  });

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId?.toString() ?? null,
    },
  };
}
