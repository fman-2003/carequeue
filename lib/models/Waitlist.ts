import mongoose, { Schema, Document } from "mongoose";

export interface IWaitlist extends Document {
  patientId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId;
  date: Date;
  timeSlot: string;
  reason?: string;
  position: number; // order in the queue
  status:
    | "waiting"
    | "notified"
    | "accepted"
    | "declined"
    | "expired"
    | "removed";
  offeredDate?: Date;
  offeredTimeSlot?: string;
  notifiedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    reason: { type: String },
    position: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "waiting",
        "notified",
        "accepted",
        "declined",
        "expired",
        "removed",
      ],
      default: "waiting",
    },
    offeredDate: { type: Date, required: false },
    offeredTimeSlot: { type: String, required: false },
    notifiedAt: { type: Date, required: false },
    expiresAt: { type: Date, required: false },
  },
  { timestamps: true },
);

WaitlistSchema.index({ doctorId: 1, status: 1, position: 1 });

export default mongoose.models.Waitlist ||
  mongoose.model<IWaitlist>("Waitlist", WaitlistSchema);
