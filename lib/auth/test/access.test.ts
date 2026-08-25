import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the access-control fixes.
 *
 * Each case here corresponds to a way patient data could previously be
 * read or written by someone with no relationship to the patient.
 */

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  user: { exists: vi.fn() },
  appointment: { findById: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/User", () => ({ default: mocks.user }));
vi.mock("@/lib/models/Appointment", () => ({ default: mocks.appointment }));

import { resolvePatientAccess, authorizeAppointment } from "../access";

const PATIENT_A = "652f1a2b3c4d5e6f70819200";
const PATIENT_B = "652f1a2b3c4d5e6f70819201";
const DOCTOR = "652f1a2b3c4d5e6f70819202";
const CLINIC_A = "652f1a2b3c4d5e6f70819210";
const CLINIC_B = "652f1a2b3c4d5e6f70819211";

const leanOf = (value: unknown) => ({
  lean: vi.fn().mockResolvedValue(value),
});

describe("resolvePatientAccess", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
  });

  it("gives a patient their own id and ignores no request parameter", async () => {
    const result = await resolvePatientAccess(
      { userId: PATIENT_A, email: "a@test", role: "patient" },
      null,
    );
    expect(result.error).toBeNull();
    expect(result.patientId).toBe(PATIENT_A);
  });

  it("refuses a patient who names another patient's id", async () => {
    const result = await resolvePatientAccess(
      { userId: PATIENT_A, email: "a@test", role: "patient" },
      PATIENT_B,
    );
    expect(result.patientId).toBeNull();
    expect(result.error?.status).toBe(403);
    // The lookup must not even be attempted.
    expect(mocks.user.exists).not.toHaveBeenCalled();
  });

  it("refuses a receptionist reading clinical records", async () => {
    const result = await resolvePatientAccess(
      {
        userId: "staff-1",
        email: "r@test",
        role: "receptionist",
        clinicId: CLINIC_A,
      },
      PATIENT_A,
    );
    expect(result.patientId).toBeNull();
    expect(result.error?.status).toBe(403);
  });

  it("refuses an admin reading clinical records", async () => {
    const result = await resolvePatientAccess(
      {
        userId: "admin-1",
        email: "ad@test",
        role: "admin",
        clinicId: CLINIC_A,
      },
      PATIENT_A,
    );
    expect(result.patientId).toBeNull();
    expect(result.error?.status).toBe(403);
  });

  it("lets a doctor reach a patient registered at their own clinic", async () => {
    mocks.user.exists.mockResolvedValue({ _id: PATIENT_A });

    const result = await resolvePatientAccess(
      { userId: DOCTOR, email: "d@test", role: "doctor", clinicId: CLINIC_A },
      PATIENT_A,
    );

    expect(result.error).toBeNull();
    expect(result.patientId).toBe(PATIENT_A);
    // The clinic filter is the authorization check, and it comes from the
    // token — not from the request.
    expect(mocks.user.exists).toHaveBeenCalledWith({
      _id: PATIENT_A,
      role: "patient",
      clinicId: CLINIC_A,
    });
  });

  it("refuses a doctor reaching a patient at another clinic", async () => {
    // No match, because the clinic in the filter is the doctor's own.
    mocks.user.exists.mockResolvedValue(null);

    const result = await resolvePatientAccess(
      { userId: DOCTOR, email: "d@test", role: "doctor", clinicId: CLINIC_B },
      PATIENT_A,
    );

    expect(result.patientId).toBeNull();
    expect(result.error?.status).toBe(404);
  });

  it("refuses a doctor with no clinic on their session", async () => {
    const result = await resolvePatientAccess(
      { userId: DOCTOR, email: "d@test", role: "doctor" },
      PATIENT_A,
    );
    expect(result.patientId).toBeNull();
    expect(result.error?.status).toBe(403);
    expect(mocks.user.exists).not.toHaveBeenCalled();
  });

  it("rejects an operator-injection payload in place of an id", async () => {
    const result = await resolvePatientAccess(
      { userId: DOCTOR, email: "d@test", role: "doctor", clinicId: CLINIC_A },
      { $ne: null },
    );
    expect(result.patientId).toBeNull();
    expect(result.error?.status).toBe(400);
    expect(mocks.user.exists).not.toHaveBeenCalled();
  });
});

describe("authorizeAppointment", () => {
  const appointment = {
    _id: "652f1a2b3c4d5e6f70819220",
    patientId: PATIENT_A,
    doctorId: DOCTOR,
    clinicId: CLINIC_A,
  };

  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.appointment.findById.mockReturnValue(leanOf(appointment));
  });

  it("allows the patient on the appointment", async () => {
    const result = await authorizeAppointment(
      { userId: PATIENT_A, email: "a@test", role: "patient" },
      appointment._id,
    );
    expect(result.error).toBeNull();
  });

  it("allows the assigned doctor", async () => {
    const result = await authorizeAppointment(
      { userId: DOCTOR, email: "d@test", role: "doctor", clinicId: CLINIC_A },
      appointment._id,
    );
    expect(result.error).toBeNull();
  });

  it("refuses an unrelated patient", async () => {
    const result = await authorizeAppointment(
      { userId: PATIENT_B, email: "b@test", role: "patient" },
      appointment._id,
    );
    expect(result.appointment).toBeNull();
    // 404 rather than 403, so the response does not confirm the id exists.
    expect(result.error?.status).toBe(404);
  });

  it("refuses a doctor who is not the one assigned", async () => {
    const result = await authorizeAppointment(
      {
        userId: "652f1a2b3c4d5e6f70819299",
        email: "other@test",
        role: "doctor",
        clinicId: CLINIC_A,
      },
      appointment._id,
    );
    expect(result.error?.status).toBe(404);
  });

  it("refuses front-desk staff from a different clinic", async () => {
    const result = await authorizeAppointment(
      {
        userId: "staff-1",
        email: "r@test",
        role: "receptionist",
        clinicId: CLINIC_B,
      },
      appointment._id,
    );
    expect(result.error?.status).toBe(404);
  });

  it("allows front-desk staff at the owning clinic", async () => {
    const result = await authorizeAppointment(
      {
        userId: "staff-1",
        email: "r@test",
        role: "receptionist",
        clinicId: CLINIC_A,
      },
      appointment._id,
    );
    expect(result.error).toBeNull();
  });

  it("rejects a malformed appointment id before querying", async () => {
    const result = await authorizeAppointment(
      { userId: PATIENT_A, email: "a@test", role: "patient" },
      "not-an-id",
    );
    expect(result.error?.status).toBe(400);
    expect(mocks.appointment.findById).not.toHaveBeenCalled();
  });
});
