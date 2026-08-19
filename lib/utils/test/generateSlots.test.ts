import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  find: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/Appointment", () => ({ default: { find: mocks.find } }));

import { generateAllSlots, getAvailableSlots } from "../generateSlots";

describe("generateAllSlots", () => {
  it("returns consecutive slots and excludes a trailing partial slot", () => {
    expect(
      generateAllSlots({
        openingTime: "08:00",
        closingTime: "09:10",
        slotDurationMinutes: 30,
      }),
    ).toEqual(["08:00 - 08:30", "08:30 - 09:00"]);
  });

  it("returns no slots when the operating window is shorter than a slot", () => {
    expect(
      generateAllSlots({
        openingTime: "08:00",
        closingTime: "08:15",
        slotDurationMinutes: 30,
      }),
    ).toEqual([]);
  });
});

describe("getAvailableSlots", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ timeSlot: "08:30 - 09:00" }]),
      }),
    });
  });

  it("awaits the database and marks only confirmed bookings unavailable", async () => {
    await expect(
      getAvailableSlots({
        clinicId: "clinic-1",
        doctorId: "doctor-1",
        date: "2026-08-20",
        openingTime: "08:00",
        closingTime: "09:00",
        slotDurationMinutes: 30,
      }),
    ).resolves.toEqual([
      { timeSlot: "08:00 - 08:30", available: true },
      { timeSlot: "08:30 - 09:00", available: false },
    ]);

    expect(mocks.connectDB).toHaveBeenCalledOnce();
    expect(mocks.find).toHaveBeenCalledWith({
      clinicId: "clinic-1",
      doctorId: "doctor-1",
      date: new Date("2026-08-20"),
      status: "confirmed",
    });
  });
});
