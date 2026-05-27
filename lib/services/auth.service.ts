/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { signToken } from "@/lib/auth/jwt";
import { SignupInput, LoginInput } from "@/lib/validations/auth.schema";

export async function signupUser(data: SignupInput) {
  await connectDB();
  try {
    // checks if email exists before trying to create
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new Error("Email already in use");
    }

    // password hashing already happens automatically in the pre-save hook
    const user = await User.create(data);

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
