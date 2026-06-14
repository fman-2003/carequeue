/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Clinic from "@/lib/models/Clinic";
import { signToken } from "@/lib/auth/jwt";
import { SignupInput, LoginInput } from "@/lib/validations/auth.schema";

// lib/services/auth.service.ts — update registerUser

export async function signupUser(data: SignupInput) {
  await connectDB();

  let assignedClinicId: string | undefined;

  if (data.role === "doctor" || data.role === "receptionist") {
    if (!data.inviteCode) {
      throw new Error(
        `Doctors and receptionists must have an invite code from their clinic admin. Contact your clinic admin to get one.`,
      );
    }

    const clinic = await Clinic.findOne({
      "inviteCodes.code": data.inviteCode,
      "inviteCodes.isUsed": false,
    });

    if (!clinic) {
      throw new Error(
        "Invalid or already used invite code. Contact your clinic admin.",
      );
    }

    const inviteEntry = clinic.inviteCodes.find(
      (c: any) => c.code === data.inviteCode && !c.isUsed,
    );

    if (!inviteEntry) {
      throw new Error("Invalid invite code.");
    }

    if (inviteEntry.role !== data.role) {
      throw new Error(
        `This invite code is for a ${inviteEntry.role}, not a ${data.role}. Contact your clinic admin.`,
      );
    }

    assignedClinicId = clinic._id.toString();
  }

  const existingUser = await User.findOne({ email: data.email });
  if (existingUser) throw new Error("Email already in use");

  try {
    const user = await User.create({
      ...data,
      clinicId: assignedClinicId || undefined,
    });

    // marking the invite code as used
    if (assignedClinicId && data.inviteCode) {
      await Clinic.findByIdAndUpdate(
        assignedClinicId,
        {
          $set: {
            "inviteCodes.$[elem].isUsed": true,
            "inviteCodes.$[elem].usedBy": user._id,
          },
        },
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
      },
    };
  } catch (err: any) {
    if (err.code === 11000) throw new Error("Email already in use");
    throw err;
  }
}

export async function loginUser(data: LoginInput) {
  try {
    await connectDB();
    const user = await User.findOne({ email: data.email }).select("+password");
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw new Error("Invalid email or password");
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
      },
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
}
