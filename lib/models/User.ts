/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

/**
 * The IUser interface is TypeScript telling you exactly
 * what shape a User document has. This gives you autocomplete
 * and type safety everywhere you use a User.
 */
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "doctor" | "receptionist" | "patient";
  clinicId?: mongoose.Types.ObjectId;
  preferredDoctorId?: mongoose.Types.ObjectId;
  profilePicture?: string;
  phone?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["admin", "doctor", "receptionist", "patient"],
      default: "patient",
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      default: null,
    },
    preferredDoctorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    phone: { type: String, unique: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  try {
    this.password = await bcrypt.hash(this.password, 12);
  } catch (err: any) {
    throw new Error(`${err.message}:Password hashing failed`);
  }
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
