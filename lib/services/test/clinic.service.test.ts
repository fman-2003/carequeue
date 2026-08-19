import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  clinic: { findOne: vi.fn(), create: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn() },
  user: { findByIdAndUpdate: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/Clinic", () => ({ default: mocks.clinic }));
vi.mock("@/lib/models/User", () => ({ default: mocks.user }));

import { createClinic, getClinic, updateClinic } from "../clinic.service";

const clinicInput = {
  name: "Care Clinic",
  address: "12 Health Street",
  phone: "08012345678",
  email: "hello@care.test",
  state: "Lagos",
  lga: "Ikeja",
};

describe("clinic service", () => {
  beforeEach(() => mocks.connectDB.mockResolvedValue(undefined));

  describe("createClinic", () => {
    it("rejects duplicate emails before writing a clinic", async () => {
      mocks.clinic.findOne.mockResolvedValue({ _id: "existing" });

      await expect(createClinic(clinicInput, "admin-1")).rejects.toThrow(
        "A clinic with this email already exists",
      );
      expect(mocks.clinic.create).not.toHaveBeenCalled();
    });

    it("persists the supplied clinic data with its owning admin", async () => {
      const created = { _id: "clinic-1", ...clinicInput };
      mocks.clinic.findOne.mockResolvedValue(null);
      mocks.clinic.create.mockResolvedValue(created);
      mocks.user.findByIdAndUpdate.mockResolvedValue({});

      await expect(createClinic(clinicInput, "admin-1")).resolves.toBe(created);
      expect(mocks.clinic.create).toHaveBeenCalledWith({ ...clinicInput, adminId: "admin-1" });
      expect(mocks.user.findByIdAndUpdate).toHaveBeenCalledWith("admin-1", { clinicId: "clinic-1" });
    });
  });

  describe("getClinic", () => {
    it("rejects a missing clinic", async () => {
      mocks.clinic.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(getClinic("missing")).rejects.toThrow("Clinic not found");
    });
  });

  describe("updateClinic", () => {
    it("scopes updates to the owning admin", async () => {
      mocks.clinic.findOneAndUpdate.mockResolvedValue(null);

      await expect(updateClinic("clinic-1", "wrong-admin", { name: "Changed" })).rejects.toThrow(
        "Clinic not found or you do not have permission",
      );
      expect(mocks.clinic.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "clinic-1", adminId: "wrong-admin" },
        { $set: { name: "Changed" } },
        { new: true },
      );
    });
  });
});
