import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  user: { findOne: vi.fn() },
  waitlist: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
  appointment: { findOne: vi.fn(), findByIdAndUpdate: vi.fn() },
  clinic: { findById: vi.fn() },
  sendWhatsAppMessage: vi.fn(),
  respondToWaitlist: vi.fn(),
  triggerWaitlist: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/User", () => ({ default: mocks.user }));
vi.mock("@/lib/models/Waitlist", () => ({ default: mocks.waitlist }));
vi.mock("@/lib/models/Appointment", () => ({ default: mocks.appointment }));
vi.mock("@/lib/models/Clinic", () => ({ default: mocks.clinic }));
vi.mock("@/lib/notifications/whatsapp", () => ({ sendWhatsAppMessage: mocks.sendWhatsAppMessage }));
vi.mock("@/lib/notifications/templates", () => ({ notificationTemplates: { unknownCommand: vi.fn().mockReturnValue({ message: "help", buttons: [] }) } }));
vi.mock("@/lib/services/waitlist.service", () => ({ respondToWaitlist: mocks.respondToWaitlist, triggerWaitlist: mocks.triggerWaitlist }));

import { handleButtonPayload, handleIncomingWhatsApp } from "../webhook.service";

describe("webhook service", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.sendWhatsAppMessage.mockResolvedValue(undefined);
  });

  it("replies to unknown senders without attempting a data update", async () => {
    mocks.user.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await expect(handleIncomingWhatsApp({ phone: "08012345678", command: "CONFIRM" })).resolves.toBeUndefined();
    expect(mocks.sendWhatsAppMessage).toHaveBeenCalledWith(expect.objectContaining({ to: "08012345678" }));
    expect(mocks.appointment.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("confirms the nearest pending appointment for a known patient", async () => {
    mocks.user.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "patient-1", name: "Ada", phone: "08012345678" }) });
    mocks.appointment.findOne.mockReturnValue({ sort: vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: "appointment-1", status: "pending" }) }) });
    await expect(handleIncomingWhatsApp({ phone: "08012345678", command: "CONFIRM" })).resolves.toBeUndefined();
    expect(mocks.appointment.findByIdAndUpdate).toHaveBeenCalledWith("appointment-1", { status: "confirmed" });
  });

  it("ignores malformed button payloads before looking up a user", async () => {
    await expect(handleButtonPayload({ phone: "08012345678", payload: "not-a-payload" })).resolves.toBeUndefined();
    expect(mocks.user.findOne).not.toHaveBeenCalled();
  });
});
