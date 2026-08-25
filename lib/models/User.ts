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
    /**
     * Sparse, because a unique index counts missing values as a single
     * null: without it only one account in the whole system could exist
     * without a phone number, and every later phone-less signup would
     * fail with a duplicate key error.
     *
     * This field is also an authentication surface — the WhatsApp webhook
     * identifies a user purely by the number that messaged it — so it is
     * format-validated on both signup and profile update.
     */
    phone: { type: String, unique: true, sparse: true, trim: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/**
 * `select: false` on password keeps it out of ordinary reads, but a
 * `.select("+password")` or a lean query elsewhere can still surface it.
 * Strip it (and the mongoose version key) from anything serialised to
 * JSON as a last line of defence against leaking a hash in a response.
 */
UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    delete plain.password;
    delete plain.__v;
    return plain;
  },
});

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
