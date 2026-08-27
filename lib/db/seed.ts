import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { connectDB } from "./index";
import User from "../models/User";
import Clinic from "../models/Clinic";
import Appointment from "../models/Appointment";
import Waitlist from "../models/Waitlist";
import { faker } from "@faker-js/faker";
import crypto from "crypto";

/**
 * Seed credentials.
 *
 * The admin password used to be a literal in this file, committed to the
 * repository. Anything hardcoded here is public to everyone with repo
 * access — and a password reused from elsewhere is worse still.
 *
 * Set SEED_ADMIN_PASSWORD to choose one; otherwise a random password is
 * generated per run and printed once at the end.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@carequeue.local";
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD || generatePassword();
const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD || generatePassword();
const PATIENT_PASSWORD =
  process.env.SEED_PATIENT_PASSWORD || generatePassword();

function generatePassword() {
  // Satisfies the signup policy: length, a letter, and a digit.
  return "Cq" + crypto.randomBytes(12).toString("base64url").slice(0, 16) + "7";
}

async function seed() {
  /**
   * This script deletes every user, clinic, appointment, and waitlist
   * entry before writing fixtures. Pointing it at a live database would
   * destroy real patient data, so it refuses to run unless the caller has
   * said so explicitly.
   */
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DESTRUCTIVE_SEED) {
    console.error(
      "Refusing to seed with NODE_ENV=production. This wipes all data. Set ALLOW_DESTRUCTIVE_SEED=1 to override.",
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || "";
  if (/prod/i.test(uri) && !process.env.ALLOW_DESTRUCTIVE_SEED) {
    console.error(
      "MONGODB_URI looks like a production database and this script deletes all data. Set ALLOW_DESTRUCTIVE_SEED=1 to override.",
    );
    process.exit(1);
  }
  let retries = 3;
  while (retries > 0) {
    try {
      await connectDB();
      break;
    } catch (err) {
      retries--;
      console.log(`Connection failed. Retrying... (${retries} attempts left)`);
      if (retries === 0) throw err;
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  console.log("Clearing existing data...");
  await Promise.all([
    User.deleteMany({}),
    Clinic.deleteMany({}),
    Appointment.deleteMany({}),
    Waitlist.deleteMany({}),
  ]);

  console.log("Seeding database...");

  // ─── ADMIN ───────────────────────────────────
  const admin = await User.create({
    name: "Fulfilment Olatunji",
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: "admin",
    phone: "+2348012345678",
  });

  // ─── CLINIC ──────────────────────────────────
  const clinic = await Clinic.create({
    name: "UITH",
    address: "12 Hospital Road, Ilorin, Kwara State",
    phone: "+2348012345678",
    email: "clinic@carequeue.com",
    state: "Kwara",
    lga: "Ilorin South",
    openingTime: "08:00",
    closingTime: "17:00",
    slotDurationMinutes: 30,
    workingDays: [1, 2, 3, 4, 5],
    adminId: admin._id,
  });

  // update admin with clinicId
  await User.findByIdAndUpdate(admin._id, { clinicId: clinic._id });

  // ─── DOCTORS ─────────────────────────────────
  const doctors = await Promise.all(
    Array.from({ length: 5 }).map(() =>
      User.create({
        name: `Dr. ${faker.person.fullName()}`,
        email: faker.internet.email(),
        password: STAFF_PASSWORD,
        role: "doctor",
        phone: `+2348${faker.string.numeric(9)}`,
        clinicId: clinic._id,
      }),
    ),
  );

  // ─── PATIENTS ────────────────────────────────
  const patients = await Promise.all(
    Array.from({ length: 20 }).map((_, i) =>
      User.create({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: PATIENT_PASSWORD,
        role: "patient",
        phone: `+2348${faker.string.numeric(9)}`,
        clinicId: clinic._id,

        // we assign a preferred doctor to every other patient
        // to test the preferred doctor feature.
        preferredDoctorId: i % 2 === 0 ? doctors[i % doctors.length]._id : null,
      }),
    ),
  );

  // ─── APPOINTMENTS + WAITLIST ENTRIES ─────────

  //  We create appointments first, then immediately
  //  create a matching waitlist entry for each one
  //  since appointmentId is now required on Waitlist.
  const timeSlots = [
    "08:00 - 08:30",
    "09:00 - 09:30",
    "10:00 - 10:30",
    "11:00 - 11:30",
    "14:00 - 14:30",
    "15:00 - 15:30",
  ];

  const statuses = [
    "pending",
    "confirmed",
    "completed",
    "no-show",
    "cancelled",
  ];

  // track position per doctor for FIFO waitlist ordering
  const doctorPositionMap: Record<string, number> = {};

  for (let i = 0; i < 51; i++) {
    const patient = patients[i % patients.length];
    const doctor = doctors[i % doctors.length];
    const date = faker.date.soon({ days: 14 });
    const timeSlot = timeSlots[i % timeSlots.length];
    const status = statuses[i % statuses.length];

    // normalize date to midnight to avoid time-of-day conflicts
    date.setHours(0, 0, 0, 0);

    const appointment = await Appointment.create({
      patientId: patient._id,
      clinicId: clinic._id,
      doctorId: doctor._id,
      date,
      timeSlot,
      reason: faker.lorem.sentence(),
      status,
    });

    /**
     * Only create waitlist entries for active appointments.
     * cancelled/completed/no-show appointments shouldn't
     * have active waitlist entries.
     */
    if (status === "pending" || status === "confirmed") {
      const doctorKey = doctor._id.toString();

      if (!doctorPositionMap[doctorKey]) {
        doctorPositionMap[doctorKey] = 1;
      }

      await Waitlist.create({
        patientId: patient._id,
        clinicId: clinic._id,
        doctorId: doctor._id,
        appointmentId: appointment._id,
        date,
        timeSlot,
        position: doctorPositionMap[doctorKey],
        status: "waiting",
      });

      doctorPositionMap[doctorKey]++;
    }
  }

  console.log("─────────────────────────────────────");
  console.log("Seed complete ✅");
  console.log("─────────────────────────────────────");
  console.log("Admin    → " + ADMIN_EMAIL);
  console.log("Admin pw → " + ADMIN_PASSWORD);
  console.log("Staff pw → " + STAFF_PASSWORD);
  console.log("Patient pw → " + PATIENT_PASSWORD);
  console.log("(Generated per run unless SEED_*_PASSWORD is set. Not stored.)");
  console.log(`Clinic   → ${clinic.name}`);
  console.log("─────────────────────────────────────");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
