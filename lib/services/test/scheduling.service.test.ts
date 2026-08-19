import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  clinic: { findById: vi.fn() },
  user: { find: vi.fn(), findById: vi.fn() },
  appointment: { find: vi.fn() },
  getAvailableSlots: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/Clinic", () => ({ default: mocks.clinic }));
vi.mock("@/lib/models/User", () => ({ default: mocks.user }));
vi.mock("@/lib/models/Appointment", () => ({ default: mocks.appointment }));
vi.mock("@/lib/utils/generateSlots", () => ({ getAvailableSlots: mocks.getAvailableSlots }));

import { smartSchedule } from "../scheduling.service";

const request = { clinicId: "clinic-1", patientId: "patient-1", message: "I need a morning appointment" };

describe("smartSchedule", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.user.find.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    mocks.user.findById.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ name: "Ada" }) }) });
    mocks.appointment.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) }) });
  });

  it("rejects when the clinic has no doctors, without calling the AI", async () => {
    await expect(smartSchedule(request)).rejects.toThrow("No doctors found at this clinic");
    expect(mocks.getAvailableSlots).not.toHaveBeenCalled();
  });

  it("returns a useful fallback when no database-backed slots are available", async () => {
    mocks.user.find.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "doctor-1", name: "Dr B" }]) }) });
    mocks.clinic.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ workingDays: [0, 1, 2, 3, 4, 5, 6], openingTime: "08:00", closingTime: "09:00", slotDurationMinutes: 30 }) });
    mocks.getAvailableSlots.mockResolvedValue([]);

    await expect(smartSchedule(request)).resolves.toEqual({
      reply: "Unfortunately there are no available slots in the next 14 days. Please try again later or join the waitlist.",
      slots: [],
    });
    expect(mocks.getAvailableSlots).toHaveBeenCalled();
  });

  it("awaits the AI response and returns its parsed suggestions", async () => {
    mocks.user.find.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "doctor-1", name: "Dr B" }]) }) });
    mocks.clinic.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ workingDays: [0, 1, 2, 3, 4, 5, 6], openingTime: "08:00", closingTime: "09:00", slotDurationMinutes: 30 }) });
    mocks.getAvailableSlots.mockResolvedValue([{ timeSlot: "08:00 - 08:30", available: true }]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ content: [{ text: '```json {"reply":"Here is a slot","suggestions":[{"doctorId":"doctor-1","doctorName":"Dr B","date":"2026-08-20","timeSlot":"08:00 - 08:30"}]} ```' }] }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(smartSchedule(request)).resolves.toMatchObject({ reply: "Here is a slot", suggestions: [{ doctorId: "doctor-1" }] });
    expect(fetchMock).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({ method: "POST" }));
  });
});
