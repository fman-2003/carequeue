import { z } from "zod";

export const medicalProfileSchema = z.object({
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  genotype: z.enum(["AA", "AS", "SS", "AC", "SC"]).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  height: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  currentMedications: z
    .array(
      z.object({
        name: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
      }),
    )
    .optional(),
  pastSurgeries: z.array(z.string()).optional(),
  familyHistory: z.array(z.string()).optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1),
      relationship: z.string().min(1),
      phone: z.string().min(1),
    })
    .optional(),
  insuranceProvider: z.string().optional(),
  insuranceNumber: z.string().optional(),
});

export const visitRecordSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  vitals: z
    .object({
      bloodPressure: z.string().optional(),
      temperature: z.number().optional(),
      pulseRate: z.number().optional(),
      respiratoryRate: z.number().optional(),
      oxygenSaturation: z.number().optional(),
      weight: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
  chiefComplaint: z.string().min(1, "Chief complaint is required"),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  clinicalNotes: z.string().min(1, "Clinical notes are required"),
  treatmentPlan: z.string().min(1, "Treatment plan is required"),
  prescriptions: z
    .array(
      z.object({
        medication: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        duration: z.string().min(1),
        instructions: z.string().optional(),
      }),
    )
    .optional(),
  labTestsOrdered: z.array(z.string()).optional(),
  followUpDate: z.string().datetime().optional(),
  referral: z.string().optional(),
});

export type MedicalProfileInput = z.infer<typeof medicalProfileSchema>;
export type VisitRecordInput = z.infer<typeof visitRecordSchema>;
