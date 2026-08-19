import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connectDB: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/Appointment", () => ({ default: { find: mocks.find } }));

import { extractFeatures, predictNoShow, trainModel } from "../prediction.service";

describe("prediction service", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
  });

  it("extracts bounded, normalized features for a first-time patient", async () => {
    const features = await extractFeatures(
      "patient-1",
      new Date("2026-08-23T12:00:00Z"),
      new Date("2026-08-20T12:00:00Z"),
    );
    expect(features).toEqual([0, expect.any(Number), 0.1, 0.5, 0, 1]);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ patientId: "patient-1", status: { $in: ["completed", "no-show"] } }));
  });

  it("returns the neutral score asynchronously until a model is trained", async () => {
    await expect(predictNoShow("patient-1", new Date("2026-08-23T12:00:00Z"))).resolves.toBe(0.5);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("does not train or create tensors with insufficient history", async () => {
    mocks.find.mockReturnValue({ populate: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
    await expect(trainModel()).resolves.toBeNull();
  });
});
