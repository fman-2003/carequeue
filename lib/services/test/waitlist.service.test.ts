import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  waitlist: { findOne: vi.fn(), countDocuments: vi.fn(), create: vi.fn(), find: vi.fn(), findByIdAndUpdate: vi.fn() },
  appointment: { findOne: vi.fn(), create: vi.fn(), findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  user: { findById: vi.fn() },
  clinic: { findById: vi.fn() },
  sendWhatsAppMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/Waitlist", () => ({ default: mocks.waitlist }));
vi.mock("@/lib/models/Appointment", () => ({ default: mocks.appointment }));
vi.mock("@/lib/models/User", () => ({ default: mocks.user }));
vi.mock("@/lib/models/Clinic", () => ({ default: mocks.clinic }));
vi.mock("@/lib/notifications/whatsapp", () => ({ sendWhatsAppMessage: mocks.sendWhatsAppMessage }));
vi.mock("@/lib/notifications/templates", () => ({ notificationTemplates: {
  waitlistJoined: vi.fn().mockReturnValue({ message: "joined", buttons: [] }),
  waitlistNotification: vi.fn().mockReturnValue({ message: "offered", buttons: [] }),
  appointmentConfirmedByDoctor: vi.fn().mockReturnValue({ message: "confirmed", buttons: [] }),
} }));

import { getWaitlist, joinWaitlist, respondToWaitlist, triggerWaitlist } from "../waitlist.service";

const appointment = { _id: "appointment-1", patientId: "patient-1", clinicId: "clinic-1", doctorId: "507f1f77bcf86cd799439011", date: new Date("2026-08-22"), timeSlot: "10:00 - 10:30" };

describe("waitlist service", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.sendWhatsAppMessage.mockResolvedValue(undefined);
  });

  describe("joinWaitlist", () => {
    it("rejects an appointment that is not confirmed for the patient", async () => {
      mocks.appointment.findOne.mockResolvedValue(null);
      await expect(joinWaitlist("appointment-1", "patient-1")).rejects.toThrow("Only confirmed appointments can be added to the waitlist");
      expect(mocks.waitlist.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate active entry before writing another queue record", async () => {
      mocks.appointment.findOne.mockResolvedValue(appointment);
      mocks.waitlist.findOne.mockResolvedValue({ _id: "existing" });
      await expect(joinWaitlist("appointment-1", "patient-1")).rejects.toThrow("already on the waitlist");
      expect(mocks.waitlist.create).not.toHaveBeenCalled();
    });

    it("creates a FIFO waiting entry from the confirmed appointment", async () => {
      mocks.appointment.findOne.mockResolvedValue(appointment);
      mocks.waitlist.findOne.mockResolvedValue(null);
      mocks.waitlist.countDocuments.mockResolvedValue(2);
      mocks.waitlist.create.mockResolvedValue({ _id: "waitlist-1" });
      mocks.user.findById.mockImplementation((id: string) => ({ lean: vi.fn().mockResolvedValue(id === "patient-1" ? { name: "Ada", phone: "08012345678" } : { name: "Dr B" }) }));

      await expect(joinWaitlist("appointment-1", "patient-1")).resolves.toEqual({ _id: "waitlist-1" });
      expect(mocks.waitlist.create).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: "appointment-1", position: 3, status: "waiting" }));
      expect(mocks.sendWhatsAppMessage).toHaveBeenCalledOnce();
    });
  });

  describe("triggerWaitlist", () => {
    it("returns null and does not update a queue when no later candidate exists", async () => {
      mocks.waitlist.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
      await expect(triggerWaitlist("clinic-1", "507f1f77bcf86cd799439011", new Date("2026-08-20"), "09:00 - 09:30")).resolves.toBeNull();
      expect(mocks.waitlist.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("respondToWaitlist", () => {
    it("rejects an inactive offer without creating an appointment", async () => {
      mocks.waitlist.findOne.mockResolvedValue({ status: "waiting" });
      await expect(respondToWaitlist("waitlist-1", "patient-1", "ACCEPT")).rejects.toThrow("This offer is no longer active");
      expect(mocks.appointment.create).not.toHaveBeenCalled();
    });

    it("does not create a replacement appointment when the offered slot conflicts", async () => {
      mocks.waitlist.findOne.mockResolvedValue({ _id: "waitlist-1", status: "notified", patientId: "patient-1", doctorId: "doctor-1", clinicId: "clinic-1", offeredDate: new Date("2026-08-20"), offeredTimeSlot: "09:00 - 09:30" });
      mocks.appointment.findOne.mockResolvedValue({ _id: "conflict" });
      await expect(respondToWaitlist("waitlist-1", "patient-1", "ACCEPT")).rejects.toThrow("slot was just taken");
      expect(mocks.waitlist.findByIdAndUpdate).toHaveBeenCalledWith("waitlist-1", { status: "waiting" });
      expect(mocks.appointment.create).not.toHaveBeenCalled();
    });
  });

  describe("getWaitlist", () => {
    it("filters entries to the requested patient and active statuses", async () => {
      const lean = vi.fn().mockResolvedValue([]);
      const sort = vi.fn().mockReturnValue({ lean });
      const query = { populate: vi.fn(), sort };
      query.populate.mockReturnValue(query);
      mocks.waitlist.find.mockReturnValue(query);
      await expect(getWaitlist("clinic-1", "patient-1")).resolves.toEqual([]);
      expect(mocks.waitlist.find).toHaveBeenCalledWith({ clinicId: "clinic-1", patientId: "patient-1", status: { $in: ["waiting", "notified"] } });
    });
  });
});
