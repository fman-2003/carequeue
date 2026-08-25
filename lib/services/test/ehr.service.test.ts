import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  profile: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
  visit: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() },
  document: { find: vi.fn(), create: vi.fn() },
  appointment: { findOne: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/MedicalProfile", () => ({ default: mocks.profile }));
vi.mock("@/lib/models/VisitRecord", () => ({ default: mocks.visit }));
vi.mock("@/lib/models/MedicalDocument", () => ({ default: mocks.document }));
vi.mock("@/lib/models/Appointment", () => ({ default: mocks.appointment }));

import {
  createVisitRecord,
  getMedicalDocuments,
  getMedicalProfile,
  getVisitRecordByAppointment,
  getVisitRecords,
  updateVisitRecord,
  upsertMedicalProfile,
} from "../ehr.service";

const visitInput = {
  appointmentId: "appointment-1",
  patientId: "patient-1",
  chiefComplaint: "Headache",
  diagnosis: "Check-up",
  clinicalNotes: "All well",
  treatmentPlan: "Rest",
};

describe("EHR service", () => {
  beforeEach(() => mocks.connectDB.mockResolvedValue(undefined));

  describe("medical profiles", () => {
    it("returns a profile or null without changing patient data", async () => {
      const lean = vi.fn().mockResolvedValue(null);
      mocks.profile.findOne.mockReturnValue({ lean });
      await expect(getMedicalProfile("patient-1")).resolves.toBeNull();
      expect(mocks.profile.findOne).toHaveBeenCalledWith({ patientId: "patient-1" });
    });

    it("upserts a profile scoped to the supplied patient and clinic", async () => {
      mocks.profile.findOneAndUpdate.mockResolvedValue({ patientId: "patient-1" });
      await expect(upsertMedicalProfile("patient-1", "clinic-1", { bloodGroup: "O+" })).resolves.toEqual({ patientId: "patient-1" });
      expect(mocks.profile.findOneAndUpdate).toHaveBeenCalledWith(
        { patientId: "patient-1" },
        { $set: { bloodGroup: "O+", clinicId: "clinic-1" }, $setOnInsert: { patientId: "patient-1" } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    });
  });

  describe("visit records", () => {
    it("returns visit records sorted newest first", async () => {
      const lean = vi.fn().mockResolvedValue([{ _id: "visit-1" }]);
      const sort = vi.fn().mockReturnValue({ lean });
      const query = { populate: vi.fn(), sort };
      query.populate.mockReturnValue(query);
      mocks.visit.find.mockReturnValue(query);

      await expect(getVisitRecords("patient-1")).resolves.toEqual([{ _id: "visit-1" }]);
      expect(mocks.visit.find).toHaveBeenCalledWith({ patientId: "patient-1" });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it("gets an appointment's record through the populated query", async () => {
      const lean = vi.fn().mockResolvedValue({ appointmentId: "appointment-1" });
      const populate = vi.fn().mockReturnValue({ lean });
      mocks.visit.findOne.mockReturnValue({ populate });
      await expect(getVisitRecordByAppointment("appointment-1")).resolves.toEqual({ appointmentId: "appointment-1" });
    });

    it("refuses to create a record for an incomplete or foreign appointment", async () => {
      mocks.appointment.findOne.mockResolvedValue(null);
      await expect(createVisitRecord(visitInput, "doctor-1", "clinic-1")).rejects.toThrow(
        "Appointment not found, not yours, or not yet completed",
      );
      expect(mocks.visit.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate record before writing", async () => {
      mocks.appointment.findOne.mockResolvedValue({ _id: "appointment-1", patientId: { toString: () => "patient-1" } });
      mocks.visit.findOne.mockResolvedValue({ _id: "visit-1" });
      await expect(createVisitRecord(visitInput, "doctor-1", "clinic-1")).rejects.toThrow("A visit record already exists for this appointment");
      expect(mocks.visit.create).not.toHaveBeenCalled();
    });

    it("creates a completed appointment record with a normalized follow-up date", async () => {
      mocks.appointment.findOne.mockResolvedValue({ _id: "appointment-1", patientId: { toString: () => "patient-1" } });
      mocks.visit.findOne.mockResolvedValue(null);
      mocks.visit.create.mockResolvedValue({ _id: "visit-1" });
      await expect(createVisitRecord({ ...visitInput, followUpDate: "2026-09-01" }, "doctor-1", "clinic-1")).resolves.toEqual({ _id: "visit-1" });
      expect(mocks.visit.create).toHaveBeenCalledWith(expect.objectContaining({ doctorId: "doctor-1", clinicId: "clinic-1", patientId: "patient-1", followUpDate: new Date("2026-09-01") }));
    });

    it("rejects updates that do not belong to the doctor", async () => {
      mocks.visit.findOneAndUpdate.mockResolvedValue(null);
      await expect(updateVisitRecord("appointment-1", "doctor-1", { diagnosis: "Updated" })).rejects.toThrow("Visit record not found or access denied");
      expect(mocks.visit.findOneAndUpdate).toHaveBeenCalledWith(
        { appointmentId: "appointment-1", doctorId: "doctor-1" },
        { $set: { diagnosis: "Updated" } },
        { new: true, runValidators: true },
      );
    });
  });

  describe("medical documents", () => {
    it("lists a patient's documents scoped to that patient, newest first", async () => {
      const lean = vi.fn().mockResolvedValue([]);
      const sort = vi.fn().mockReturnValue({ lean });
      mocks.document.find.mockReturnValue({ populate: vi.fn().mockReturnValue({ sort }) });

      await expect(getMedicalDocuments("patient-1")).resolves.toEqual([]);
      expect(mocks.document.find).toHaveBeenCalledWith({ patientId: "patient-1" });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });
});
