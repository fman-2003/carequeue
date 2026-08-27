import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  user: { findOne: vi.fn(), create: vi.fn() },
  clinic: { findOne: vi.fn(), findByIdAndUpdate: vi.fn() },
  signToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/User", () => ({ default: mocks.user }));
vi.mock("@/lib/models/Clinic", () => ({ default: mocks.clinic }));
vi.mock("@/lib/auth/jwt", () => ({ signToken: mocks.signToken }));

import { loginUser, signupUser } from "../auth.service";

describe("auth service", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.signToken.mockReturnValue("signed-token");
  });

  describe("signupUser", () => {
    it("rejects an existing email without creating a user", async () => {
      // The pre-flight findOne was removed: it raced with concurrent
      // signups. Uniqueness is now enforced by the unique index, whose
      // duplicate-key error is translated to a user-facing 409.
      const duplicate = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      mocks.user.create.mockRejectedValue(duplicate);

      await expect(signupUser({ name: "Ada", email: "ada@test.com", password: "secretpass1", role: "patient" })).rejects.toThrow(
        "Email or phone number already in use",
      );
    });

    it("creates a patient and returns a signed, safe user response", async () => {
      mocks.user.findOne.mockResolvedValue(null);
      mocks.user.create.mockResolvedValue({ _id: "user-1", name: "Ada", email: "ada@test.com", role: "patient" });

      await expect(signupUser({ name: "Ada", email: "ada@test.com", password: "secretpass1", role: "patient" })).resolves.toEqual({
        token: "signed-token",
        user: { id: "user-1", name: "Ada", email: "ada@test.com", role: "patient", clinicId: null },
      });
      // Fields are listed explicitly rather than spread, so nothing in the
      // request body can reach the model.
      expect(mocks.user.create).toHaveBeenCalledWith(expect.objectContaining({ clinicId: null, role: "patient" }));
    });
  });

  describe("loginUser", () => {
    it("rejects unknown credentials", async () => {
      mocks.user.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
      await expect(loginUser({ email: "ada@test.com", password: "secretpass1" })).rejects.toThrow("Invalid email or password");
    });

    it("returns a token only after awaiting password comparison", async () => {
      mocks.user.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: "user-1", name: "Ada", email: "ada@test.com", role: "patient", comparePassword: vi.fn().mockResolvedValue(true) }) });
      await expect(loginUser({ email: "ada@test.com", password: "secretpass1" })).resolves.toMatchObject({ token: "signed-token", user: { id: "user-1" } });
    });
  });
});
