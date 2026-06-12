/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import cloudinary from "@/lib/config/cloudinary";
import { z } from "zod";
import { signToken } from "@/lib/auth/jwt";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.email("Invalid email").optional(),
  phone: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  await connectDB();

  const user = await User.findById(payload!.userId)
    .select("-password")
    .populate("preferredDoctorId", "name email")
    .populate("clinicId", "name")
    .lean();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // profile picture upload
      const formData = await req.formData();
      const file = formData.get("profilePicture") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 },
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Profile picture must be under 5MB" },
          { status: 400 },
        );
      }

      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        return NextResponse.json(
          { error: "Only JPG, PNG, and WEBP images are allowed" },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: `carequeue/avatars`,
              public_id: `user_${payload!.userId}`,
              overwrite: true, // replace existing avatar
              transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" },
                { quality: "auto", fetch_format: "auto" },
              ],
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            },
          )
          .end(buffer);
      });

      await connectDB();
      const user = await User.findByIdAndUpdate(
        payload!.userId,
        { profilePicture: uploadResult.secure_url },
        { new: true },
      ).select("-password");

      return NextResponse.json({ user });
    } else {
      // JSON update — name, email, phone
      const body = await req.json();
      const parsed = updateProfileSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      await connectDB();

      // check email uniqueness if changing email
      if (parsed.data.email) {
        const existing = await User.findOne({
          email: parsed.data.email,
          _id: { $ne: payload!.userId },
        });
        if (existing) {
          return NextResponse.json(
            { error: "This email is already in use" },
            { status: 400 },
          );
        }
      }

      const user = await User.findByIdAndUpdate(
        payload!.userId,
        { $set: parsed.data },
        { new: true },
      ).select("-password");

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      let newToken: string | undefined;
      if (parsed.data.email) {
        newToken = signToken({
          userId: payload!.userId,
          email: parsed.data.email,
          role: payload!.role,
          clinicId: payload!.clinicId,
        });
      }

      return NextResponse.json({
        user,
        token: newToken || undefined,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
