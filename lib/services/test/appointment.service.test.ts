import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  appointment: { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn() },
  user: { findById: vi.fn(), exists: vi.fn() },
  clinic: { findById: vi.fn() },
  waitlist: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn(), findByIdAndUpdate: vi.fn() },
  predictNoShow: vi.fn(),
  sendWhatsAppMessage: vi.fn(),
  triggerWaitlist: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/Appointment", () => ({ default: mocks.appointment }));
vi.mock("@/lib/models/User", () => ({ default: mocks.user }));
vi.mock("@/lib/models/Clinic", () => ({ default: mocks.clinic }));
vi.mock("@/lib/models/Waitlist", () => ({ default: mocks.waitlist }));
vi.mock("@/lib/services/prediction.service", () => ({ predictNoShow: mocks.predictNoShow }));
vi.mock("@/lib/services/waitlist.service", () => ({ triggerWaitlist: mocks.triggerWaitlist }));
vi.mock("@/lib/notifications/whatsapp", () => ({ sendWhatsAppMessage: mocks.sendWhatsAppMessage }));
vi.mock("@/lib/notifications/templates", () => ({ notificationTemplates: {} }));

import { createAppointment, getAppointment, getAppointments, updateAppointment } from "../appointment.service";

const appointmentInput = { patientId: "patient-1", clinicId: "clinic-1", doctorId: "doctor-1", date: "2026-08-22T09:00:00.000Z", timeSlot: "09:00 - 09:30" };

const patientSession = { userId: "patient-1", role: "patient", clinicId: "clinic-1" };
const receptionistSession = { userId: "reception-1", role: "receptionist", clinicId: "clinic-1" };

describe("appointment service", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    // predictNoShow now returns an assessment (or null when no model
    // has been trained) rather than a bare score.
    mocks.predictNoShow.mockResolvedValue({ score: 0.2, highRisk: false });
    mocks.user.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    // Booking now verifies the patient and doctor belong to the
    // session’s clinic before writing anything.
    mocks.user.exists.mockResolvedValue({ _id: "exists" });
    mocks.clinic.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  });

  describe("getAppointments", () => {
    it("limits a doctor to their own clinic appointments", async () => {
      const lean = vi.fn().mockResolvedValue([]);
      const sort = vi.fn().mockReturnValue({ lean });
      const query = { populate: vi.fn(), sort };
      query.populate.mockReturnValue(query);
      mocks.appointment.find.mockReturnValue(query);
      await expect(getAppointments("clinic-1", "doctor-1", "doctor")).resolves.toEqual([]);
      expect(mocks.appointment.find).toHaveBeenCalledWith({ doctorId: "doctor-1", clinicId: "clinic-1" });
    });
  });

  describe("getAppointment", () => {
    it("rejects a missing appointment", async () => {
      const lean = vi.fn().mockResolvedValue(null);
      const query = { populate: vi.fn(), lean };
      query.populate.mockReturnValue(query);
      mocks.appointment.findOne.mockReturnValue(query);
      await expect(getAppointment("missing")).rejects.toThrow("Error fetching appointment: Appointment not found");
    });
  });

  describe("createAppointment", () => {
    it("rejects a booked doctor slot before prediction or creation", async () => {
      mocks.appointment.findOne.mockResolvedValue({ _id: "conflict" });
      await expect(createAppointment(appointmentInput, patientSession)).rejects.toThrow("This time slot is already booked");
      expect(mocks.predictNoShow).not.toHaveBeenCalled();
      expect(mocks.appointment.create).not.toHaveBeenCalled();
    });

    it("rejects a second active appointment for the patient on the same date", async () => {
      mocks.appointment.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "today" });
      await expect(createAppointment(appointmentInput, patientSession)).rejects.toThrow("cannot book more than one appointment");
      expect(mocks.appointment.create).not.toHaveBeenCalled();
    });

    it("normalizes the date and stores a prediction when booking succeeds", async () => {
      mocks.appointment.findOne.mockResolvedValue(null);
      mocks.appointment.create.mockResolvedValue({ _id: "appointment-1" });
      await expect(createAppointment(appointmentInput, receptionistSession)).resolves.toEqual({ _id: "appointment-1" });
      expect(mocks.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
        date: new Date(appointmentInput.date),
        status: "confirmed",
        noShowRisk: 0.2,
      }));
    });

    it("still books when the risk model is unavailable", async () => {
      // No model trained yet: the score is absent rather than a
      // fabricated 0.5, and the appointment is created regardless.
      mocks.predictNoShow.mockResolvedValue(null);
      mocks.appointment.findOne.mockResolvedValue(null);
      mocks.appointment.create.mockResolvedValue({ _id: "appointment-1" });

      await expect(createAppointment(appointmentInput, receptionistSession)).resolves.toEqual({ _id: "appointment-1" });
      expect(mocks.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
        noShowRisk: undefined,
      }));
    });

    it("still books when the risk model throws", async () => {
      // Scoring is a nice-to-have. It runs numeric third-party code and
      // reads a model out of the database, and neither should ever be
      // able to stop a patient booking an appointment.
      mocks.predictNoShow.mockRejectedValue(new Error("tensor backend exploded"));
      mocks.appointment.findOne.mockResolvedValue(null);
      mocks.appointment.create.mockResolvedValue({ _id: "appointment-1" });

      await expect(createAppointment(appointmentInput, receptionistSession)).resolves.toEqual({ _id: "appointment-1" });
      expect(mocks.appointment.create).toHaveBeenCalled();
    });
  });

  describe("updateAppointment", () => {
    it("rejects a reschedule that would collide with another active booking", async () => {
      mocks.appointment.findOne.mockResolvedValueOnce({ doctorId: "doctor-1", date: new Date("2026-08-22"), timeSlot: "09:00 - 09:30" }).mockResolvedValueOnce({ _id: "conflict" });
      await expect(updateAppointment("appointment-1", { timeSlot: "10:00 - 10:30" })).rejects.toThrow("This time slot is already booked");
      expect(mocks.appointment.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects a missing appointment before writing an update", async () => {
      mocks.appointment.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(updateAppointment("missing", { status: "confirmed" })).rejects.toThrow("Appointment not found");
      expect(mocks.appointment.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
