import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { connectDB } from "./index";
import User from "../models/User";
import Clinic from "../models/Clinic";
import Appointment from "../models/Appointment";
import Waitlist from "../models/Waitlist";
import { faker } from "@faker-js/faker";

async function seed() {
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
    email: "admin@carequeue.com",
    password: "Fman@2003",
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
    Array.from({ length: 3 }).map(() =>
      User.create({
        name: `Dr. ${faker.person.fullName()}`,
        email: faker.internet.email(),
        password: "password1234",
        role: "doctor",
        phone: `+2348${faker.string.numeric(9)}`,
        clinicId: clinic._id,
      }),
    ),
  );

  // ─── PATIENTS ────────────────────────────────
  const patients = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      User.create({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: "password123",
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

  for (let i = 0; i < 20; i++) {
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
  console.log("Admin    → admin@carequeue.com / password123");
  console.log("Doctors  → check MongoDB Atlas for emails");
  console.log("Patients → check MongoDB Atlas for emails");
  console.log(`Clinic   → ${clinic.name}`);
  console.log("─────────────────────────────────────");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
