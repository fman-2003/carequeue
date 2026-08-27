import { z } from "zod";

/**
 * Every free-text field carries an explicit maximum.
 *
 * Without one, a single request can push megabytes of text into a
 * document — a cheap way to inflate storage, slow every later read of
 * that record, and eventually breach MongoDB's 16MB document limit. The
 * same applies to arrays, which is why each has a length cap.
 */
const shortText = (max = 200) => z.string().trim().max(max);
const longText = (max = 5000) => z.string().trim().max(max);

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const medicalProfileSchema = z.object({
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  genotype: z.enum(["AA", "AS", "SS", "AC", "SC"]).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  height: z.number().min(0).max(300).optional(),
  weight: z.number().min(0).max(700).optional(),
  allergies: z.array(shortText()).max(100).optional(),
  chronicConditions: z.array(shortText()).max(100).optional(),
  currentMedications: z
    .array(
      z.object({
        name: shortText().min(1),
        dosage: shortText(100).min(1),
        frequency: shortText(100).min(1),
      }),
    )
    .max(100)
    .optional(),
  pastSurgeries: z.array(shortText()).max(100).optional(),
  familyHistory: z.array(shortText()).max(100).optional(),
  emergencyContact: z
    .object({
      name: shortText(100).min(1),
      relationship: shortText(100).min(1),
      phone: shortText(30).min(1),
    })
    .optional(),
  insuranceProvider: shortText(150).optional(),
  insuranceNumber: shortText(100).optional(),
});

export const visitRecordSchema = z.object({
  appointmentId: objectId,
  patientId: objectId,
  vitals: z
    .object({
      bloodPressure: shortText(20).optional(),
      temperature: z.number().min(0).max(60).optional(),
      pulseRate: z.number().min(0).max(400).optional(),
      respiratoryRate: z.number().min(0).max(200).optional(),
      oxygenSaturation: z.number().min(0).max(100).optional(),
      weight: z.number().min(0).max(700).optional(),
      height: z.number().min(0).max(300).optional(),
    })
    .optional(),
  chiefComplaint: longText(2000).min(1, "Chief complaint is required"),
  diagnosis: longText(2000).min(1, "Diagnosis is required"),
  clinicalNotes: longText().min(1, "Clinical notes are required"),
  treatmentPlan: longText().min(1, "Treatment plan is required"),
  prescriptions: z
    .array(
      z.object({
        medication: shortText().min(1),
        dosage: shortText(100).min(1),
        frequency: shortText(100).min(1),
        duration: shortText(100).min(1),
        instructions: longText(1000).optional(),
      }),
    )
    .max(50)
    .optional(),
  labTestsOrdered: z.array(shortText()).max(50).optional(),
  followUpDate: z.string().datetime().optional(),
  referral: longText(1000).optional(),
});

/**
 * Updates accept the clinical fields only. `appointmentId`, `patientId`,
 * `doctorId`, and `clinicId` identify whose record this is and are fixed
 * at creation — allowing them in an update would let a doctor re-file an
 * existing note against a different patient.
 */
export const updateVisitRecordSchema = visitRecordSchema
  .omit({ appointmentId: true, patientId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

/** Metadata accepted alongside a medical document upload. */
export const documentUploadSchema = z.object({
  patientId: objectId,
  fileType: z.enum([
    "lab_result",
    "scan",
    "referral",
    "prescription",
    "other",
  ]),
  description: longText(1000).optional(),
  appointmentId: objectId.optional(),
});

export type MedicalProfileInput = z.infer<typeof medicalProfileSchema>;
export type VisitRecordInput = z.infer<typeof visitRecordSchema>;
export type UpdateVisitRecordInput = z.infer<typeof updateVisitRecordSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
