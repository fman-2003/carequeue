import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  requireRole: vi.fn(),
  requireClinic: vi.fn(),
  assertSameOrigin: vi.fn(),
  getAppointments: vi.fn(),
  createAppointment: vi.fn(),
  find: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({
  authenticate: mocks.authenticate,
  requireRole: mocks.requireRole,
  requireClinic: mocks.requireClinic,
  assertSameOrigin: mocks.assertSameOrigin,
}));
vi.mock("@/lib/services/appointment.service", () => ({
  getAppointments: mocks.getAppointments,
  createAppointment: mocks.createAppointment,
}));
vi.mock("@/lib/models/VisitRecord", () => ({ default: { find: mocks.find } }));

import { GET, POST } from "../appointments/route";

describe("appointments routes", () => {
  beforeEach(() => {
    mocks.authenticate.mockReturnValue({
      payload: { userId: "patient-1", clinicId: "clinic-1", role: "patient" },
      error: null,
    });
    mocks.requireRole.mockReturnValue(null);
    mocks.assertSameOrigin.mockReturnValue(null);
    mocks.requireClinic.mockReturnValue({ clinicId: "clinic-1", error: null });
  });

  it("returns an authentication response before reading the request body", async () => {
    const authError = new Response(JSON.stringify({ error: "No token" }), {
      status: 401,
    });
    mocks.authenticate.mockReturnValue({ payload: null, error: authError });
    const response = await POST(
      new Request("http://care.test/api/appointments", {
        method: "POST",
      }) as never,
    );
    expect(response.status).toBe(401);
    expect(mocks.createAppointment).not.toHaveBeenCalled();
  });

  it("rejects malformed appointments without calling the persistence service", async () => {
    const response = await POST(
      new Request("http://care.test/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId: "", date: "tomorrow" }),
      }) as never,
    );
    expect(response.status).toBe(422);
    expect(mocks.createAppointment).not.toHaveBeenCalled();
  });

  it("returns the created appointment for a valid authorized request", async () => {
    mocks.createAppointment.mockResolvedValue({ _id: "appointment-1" });
    const response = await POST(
      new Request("http://care.test/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId: "652f1a2b3c4d5e6f70819200",
          clinicId: "652f1a2b3c4d5e6f70819201",
          doctorId: "652f1a2b3c4d5e6f70819202",
          date: "2026-08-22T09:00:00.000Z",
          timeSlot: "09:00 - 09:30",
        }),
      }) as never,
    );
    await expect(response.json()).resolves.toEqual({
      appointment: { _id: "appointment-1" },
    });
    expect(response.status).toBe(201);
    // The service now receives the verified session, not just a role
    // string, so it can check who is booking for whom.
    expect(mocks.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: "652f1a2b3c4d5e6f70819202" }),
      expect.objectContaining({ userId: "patient-1", role: "patient" }),
    );
  });

  it("returns service data from the list endpoint", async () => {
    mocks.getAppointments.mockResolvedValue([{ _id: "appointment-1" }]);
    const response = await GET(
      new Request("http://care.test/api/appointments") as never,
    );
    await expect(response.json()).resolves.toEqual({
      appointments: [{ _id: "appointment-1" }],
    });
  });
});
