/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/db";
import Appointment from "@/lib/models/Appointment";
import User from "@/lib/models/User";
import Clinic from "@/lib/models/Clinic";
import Waitlist from "@/lib/models/Waitlist";
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/lib/validations/appointment.schema";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { notificationTemplates } from "@/lib/notifications/templates";
import { triggerWaitlist } from "@/lib/services/waitlist.service";
import { predictNoShow } from "@/lib/services/prediction.service";

export async function getAppointments(
  clinicId: string,
  userId: string,
  userRole: string,
) {
  await connectDB();

  let filter: Record<string, any> = {};

  if (userRole === "doctor") {
    filter.doctorId = userId;
    filter.clinicId = clinicId;
  } else if (userRole === "patient") {
    filter.patientId = userId;
  } else if (userRole === "admin" || userRole === "receptionist") {
    filter.clinicId = clinicId;
  }
  try {
    // admin and receptionist get no extra filter — they see all

    return await Appointment.find(filter)
      .populate("patientId", "name email phone")
      .populate("doctorId", "name email phone")
      .populate("clinicId", "name")
      .sort({ date: -1 })
      .lean();
  } catch (error) {
    throw new Error(`Error fetching appointments: ${(error as Error).message}`);
  }
}

export async function getAppointment(id: string) {
  await connectDB();
  try {
    const appointment = await Appointment.findOne({ _id: id })
      .populate("patientId", "name email phone")
      .populate("doctorId", "name email phone")
      .populate("clinicId", "name")
      .lean();

    if (!appointment) throw new Error("Appointment not found");
    return appointment;
  } catch (error) {
    throw new Error(`Error fetching appointment: ${(error as Error).message}`);
  }
}

export async function createAppointment(
  data: CreateAppointmentInput,
  userRole: string,
) {
  await connectDB();
  try {
    // This is a basic conflict check to prevent
    // overlapping appointments for the same doctor.
    const conflict = await Appointment.findOne({
      doctorId: data.doctorId,
      date: new Date(data.date),
      timeSlot: data.timeSlot,
      status: { $nin: ["cancelled"] }, // cancelled slots are free again
    });

    if (conflict) {
      throw new Error(
        "This time slot is already booked for the selected doctor",
      );
    }

    // daily appointment limit per patient
    const existingAppointment = await Appointment.findOne({
      patientId: data.patientId,
      date: new Date(data.date),
      status: { $nin: ["cancelled"] },
    });
    if (existingAppointment) {
      throw new Error(
        "Patients cannot book more than one appointment on a set day",
      );
    }

    // Run prediction before creating the appointment.
    // The no-show risk score gets saved directly on the document
    const noShowRisk = await predictNoShow(
      data.patientId,
      new Date(data.date),
      new Date(),
    );

    const [patient, doctor, clinic] = await Promise.all([
      User.findById(data.patientId).lean(),
      User.findById(data.doctorId).lean(),
      Clinic.findById(data.clinicId).lean(),
    ]);
    const formattedDate = new Date(data.date).toDateString(); // e.g."Mon Jan 06 2025"
    let appointmentStatus = "pending";
    if (userRole === "doctor" || userRole === "receptionist") {
      appointmentStatus = "confirmed";
    }

    const appointment = await Appointment.create({
      ...data,
      date: new Date(data.date),
      status: appointmentStatus,
      noShowRisk,
    });

    /**
     * AUTO-JOIN WAITLIST
     * Every new confirmed appointment automatically places the patient
     * on the waitlist for their doctor — FIFO position.
     * NOTE: This will only happen if doctor currently has more than zero confirmed appointments before new confirmed appointment was created
     */

    // const pastConfirmedAppointments = await Appointment.countDocuments({
    //   doctorId: data.doctorId,
    //   clinicId: data.clinicId,
    //   date: { $lt: data.date },
    //   status: { $in: ["confirmed"] },
    // });

    // const currentlyOnWaitlist = await Waitlist.findOne({
    //   doctorId: data.doctorId,
    //   patientId: data.patientId,
    //   status: { $in: ["waiting", "notified"] },
    // });

    // if (
    //   !!!currentlyOnWaitlist &&
    //   pastConfirmedAppointments > 0 &&
    //   appointmentStatus === "confirmed"
    // ) {
    //   const waitlistPosition =
    //     (await Waitlist.countDocuments({
    //       doctorId: data.doctorId,
    //       status: { $in: ["waiting", "notified"] },
    //     })) + 1;

    //   await Waitlist.create({
    //     patientId: data.patientId,
    //     clinicId: data.clinicId,
    //     doctorId: data.doctorId,
    //     appointmentId: appointment._id,
    //     date: new Date(data.date),
    //     timeSlot: data.timeSlot,
    //     position: waitlistPosition,
    //     status: "waiting",
    //   });
    // }

    // notify patient with appropriate message based on status
    // CONFIRMED STATUS: doctor or receptionist created the appointment, patient will get confirmation
    if (patient?.phone && clinic) {
      if (appointmentStatus === "confirmed") {
        const notification = notificationTemplates.appointmentConfirmedByDoctor(
          patient.name,
          formattedDate,
          data.timeSlot,
          clinic.name,
          appointment._id.toString(),
        );
        await sendWhatsAppMessage({
          to: patient.phone,
          message: notification.message,
          buttons: notification.buttons,
        });
      } else {
        const notification = notificationTemplates.appointmentBookedForPatient(
          patient.name,
          formattedDate,
          data.timeSlot,
          clinic.name,
          appointment._id.toString(),
        );
        await sendWhatsAppMessage({
          to: patient.phone,
          message: notification.message,
          buttons: notification.buttons,
        });
      }
    }

    // notify doctor of new appointment
    // only notify doctor when patient books — they need to confirm
    // PENDING STATUS: patient created the appointment, doctor needs to confirm
    if (doctor?.phone && clinic) {
      if (appointmentStatus === "pending") {
        const notification = notificationTemplates.appointmentBookedForDoctor(
          doctor.name,
          formattedDate,
          data.timeSlot,
          clinic.name,
          appointment._id.toString(),
        );
        await sendWhatsAppMessage({
          to: doctor.phone,
          message: notification.message,
          buttons: notification.buttons,
        });
      }
    }

    // extra nudge for high risk patients
    if (noShowRisk >= 0.7 && patient?.phone && clinic) {
      const notification = notificationTemplates.highRiskReminder(
        patient.name,
        formattedDate,
        data.timeSlot,
        clinic.name,
        appointment._id.toString(),
      );
      await sendWhatsAppMessage({
        to: patient.phone,
        message: notification.message,
        buttons: notification.buttons,
      });
    }

    return appointment;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function updateAppointment(
  id: string,
  data: UpdateAppointmentInput,
) {
  await connectDB();

  try {
    // conflict check only when date or timeSlot is changing
    if (data.date || data.timeSlot) {
      const current = await Appointment.findOne({ _id: id });
      if (!current) throw new Error("Appointment not found");

      const checkDate = data.date ? new Date(data.date) : current.date;
      const checkTimeSlot = data.timeSlot ? data.timeSlot : current.timeSlot;

      const conflict = await Appointment.findOne({
        _id: { $ne: id },
        doctorId: current.doctorId,
        date: checkDate,
        timeSlot: checkTimeSlot,
        status: { $nin: ["cancelled"] },
      });
      if (conflict) {
        throw new Error(
          "This time slot is already booked for the selected doctor",
        );
      }
    }

    const appointmentSnapshot = await Appointment.findById(id).lean();
    if (!appointmentSnapshot) throw new Error("Appointment not found");

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id },
      { $set: data },
      { new: true },
    );
    if (!appointment) throw new Error("Appointment not found");

    // hanlde confirmation side effects
    if (data.status === "confirmed") {
      const [patient, doctor, clinic] = await Promise.all([
        User.findById(appointment.patientId).lean(),
        User.findById(appointment.doctorId).lean(),
        Clinic.findById(appointment.clinicId).lean(),
      ]);
      const formattedDate = new Date(appointment.date).toDateString();

      // const pastConfirmedAppointments = await Appointment.countDocuments({
      //   doctorId: appointment.doctorId,
      //   clinicId: appointment.clinicId,
      //   date: {
      //     $lt: appointment.date,
      //     $gt: appointment.createdAt,
      //   },
      //   status: { $in: ["confirmed"] },
      // });

      // const currentlyOnWaitlist = await Waitlist.findOne({
      //   doctorId: appointment.doctorId,
      //   patientId: appointment.patientId,
      //   status: { $in: ["waiting", "notified"] },
      // });

      // AUTO-JOIN WAITLIST
      // updated status to confirmed should also trigger waitlist join
      // as creation of appointment might not have triggered waitlist
      // if patient was the one who created appointment
      // if (!!!currentlyOnWaitlist && pastConfirmedAppointments > 0) {
      //   const waitlistPosition =
      //     (await Waitlist.countDocuments({
      //       doctorId: appointment.doctorId,
      //       status: { $in: ["waiting", "notified"] },
      //     })) + 1;
      // }

      // notify patient
      const notificationForAppointmentConfirmedByDoctorPatient =
        notificationTemplates.appointmentConfirmedByDoctor(
          patient.name,
          formattedDate,
          appointment.timeSlot,
          clinic.name,
          appointment._id.toString(),
        );
      await sendWhatsAppMessage({
        to: patient.phone,
        message: notificationForAppointmentConfirmedByDoctorPatient.message,
        buttons: notificationForAppointmentConfirmedByDoctorPatient.buttons,
      });

      // notify doctor
      const notificationForAppointmentConfirmedByDoctor =
        notificationTemplates.appointmentConfirmedByDoctor(
          doctor.name,
          formattedDate,
          appointment.timeSlot,
          clinic.name,
          appointment._id.toString(),
        );
      await sendWhatsAppMessage({
        to: doctor.phone,
        message: notificationForAppointmentConfirmedByDoctor.message,
        buttons: notificationForAppointmentConfirmedByDoctor.buttons,
      });
    }

    // handle no-show side effects
    if (data.status === "no-show") {
      const [patient, doctor, clinic] = await Promise.all([
        User.findById(appointment.patientId).lean(),
        User.findById(appointment.doctorId).lean(),
        Clinic.findById(appointment.clinicId).lean(),
      ]);
      const formattedDate = new Date(appointment.date).toDateString();

      // notify patient
      const notificationForAppointmentNoShowForPatient =
        notificationTemplates.appointmentNoShowForPatient(
          patient.name,
          formattedDate,
          appointment.timeSlot,
          clinic.name,
        );
      await sendWhatsAppMessage({
        to: patient.phone,
        message: notificationForAppointmentNoShowForPatient.message,
        buttons: notificationForAppointmentNoShowForPatient.buttons,
      });

      // notify doctor
      const notificationForAppointmentNoShowForDoctor =
        notificationTemplates.appointmentNoShowForDoctor(
          doctor.name,
          patient.name,
          formattedDate,
          appointment.timeSlot,
          clinic.name,
        );
      await sendWhatsAppMessage({
        to: doctor.phone,
        message: notificationForAppointmentNoShowForDoctor.message,
        buttons: notificationForAppointmentNoShowForDoctor.buttons,
      });

      /**
       * REMOVE PATIENT FROM WAITLIST (if they have one)
       * When an appointment is no-show, remove the
       * patient's waitlist entry linked to that appointment
       */
      const existingWaitlistEntry = await Waitlist.findOne({
        appointmentId: appointment._id,
        status: { $in: ["waiting", "notified"] },
      });
      if (existingWaitlistEntry) {
        await Waitlist.findOneAndUpdate(
          { _id: existingWaitlistEntry._id },
          { status: "removed", position: null },
        );

        const waitlistEntriesAfterRemoved = await Waitlist.find({
          doctorId: appointment.doctorId,
          status: { $in: ["waiting"] },
          position: { $gt: existingWaitlistEntry.position! },
        }).sort({ position: 1 });

        waitlistEntriesAfterRemoved.forEach(async (entry) => {
          await Waitlist.findByIdAndUpdate(entry._id, {
            $inc: { position: -1 },
          });
        });
      }
    }

    // handle completion side effects
    if (data.status === "completed") {
      const [patient, doctor, clinic] = await Promise.all([
        User.findById(appointment.patientId).lean(),
        User.findById(appointment.doctorId).lean(),
        Clinic.findById(appointment.clinicId).lean(),
      ]);
      const formattedDate = new Date(appointment.date).toDateString();

      // notify patient
      const notificationForAppointmentCompletedForPatient =
        notificationTemplates.appointmentCompletedForPatient(
          patient.name,
          formattedDate,
          appointment.timeSlot,
          clinic.name,
        );
      await sendWhatsAppMessage({
        to: patient.phone,
        message: notificationForAppointmentCompletedForPatient.message,
        buttons: notificationForAppointmentCompletedForPatient.buttons,
      });

      // notify doctor
      const notificationForAppointmentCompletedForDoctor =
        notificationTemplates.appointmentCompletedForDoctor(
          doctor.name,
          patient.name,
          formattedDate,
          appointment.timeSlot,
          clinic.name,
        );
      await sendWhatsAppMessage({
        to: doctor.phone,
        message: notificationForAppointmentCompletedForDoctor.message,
        buttons: notificationForAppointmentCompletedForDoctor.buttons,
      });

      // REMOVE PATIENT FROM WAITLIST (if user had one)
      const existingWaitlistEntry = await Waitlist.findOne({
        appointmentId: appointment._id,
        status: { $in: ["waiting", "notified"] },
      });
      if (existingWaitlistEntry) {
        await Waitlist.findOneAndUpdate(
          { _id: existingWaitlistEntry._id },
          { status: "removed", position: null },
        );

        const waitlistEntriesAfterRemoved = await Waitlist.find({
          doctorId: appointment.doctorId,
          status: { $in: ["waiting"] },
          position: { $gt: existingWaitlistEntry.position! },
        }).sort({ position: 1 });

        waitlistEntriesAfterRemoved.forEach(async (entry) => {
          await Waitlist.findByIdAndUpdate(entry._id, {
            $inc: { position: -1 },
          });
        });
      }
    }

    // handle cancellation side effects
    if (data.status === "cancelled") {
      const [patient, doctor, clinic] = await Promise.all([
        User.findById(appointment.patientId).lean(),
        User.findById(appointment.doctorId).lean(),
        Clinic.findById(appointment.clinicId).lean(),
      ]);

      const formattedDate = new Date(appointment.date).toDateString();

      // notify patient
      if (patient?.phone && clinic) {
        const notification =
          notificationTemplates.appointmentCancelledForPatient(
            patient.name,
            formattedDate,
            appointment.timeSlot,
            clinic.name,
          );
        await sendWhatsAppMessage({
          to: patient.phone,
          message: notification.message,
          buttons: notification.buttons,
        });
      }

      // notify doctor
      if (doctor?.phone && clinic) {
        const notification =
          notificationTemplates.appointmentCancelledForDoctor(
            doctor.name,
            formattedDate,
            appointment.timeSlot,
            clinic.name,
          );
        await sendWhatsAppMessage({
          to: doctor.phone,
          message: notification.message,
          buttons: notification.buttons,
        });
      }

      // remove patient's waitlist entry (if user had one) regardless of previous status
      const existingWaitlistEntry = await Waitlist.findOne({
        appointmentId: appointment._id,
        status: { $in: ["waiting", "notified"] },
      });
      if (existingWaitlistEntry) {
        await Waitlist.findOneAndUpdate(
          { _id: existingWaitlistEntry._id },
          { status: "removed", position: null },
        );

        const waitlistEntriesAfterRemoved = await Waitlist.find({
          doctorId: appointment.doctorId,
          status: { $in: ["waiting"] },
          position: { $gt: existingWaitlistEntry.position! },
        }).sort({ position: 1 });

        waitlistEntriesAfterRemoved.forEach(async (entry) => {
          await Waitlist.findByIdAndUpdate(entry._id, {
            $inc: { position: -1 },
          });
        });
      }
      // trigger waitlist for next person

      // only trigger waitlist if the appointment being cancelled was confirmed
      if (
        appointmentSnapshot.status === "confirmed" &&
        patient._id !== appointment.patientId
      ) {
        // console.log("appointment state before update:", appointmentSnapshot);
        await triggerWaitlist(
          appointment.clinicId.toString(),
          appointment.doctorId.toString(),
          appointment.date,
          appointment.timeSlot,
        );
      }
    }

    return appointment;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

// export async function deleteAppointment(id: string, clinicId: string) {
//   await connectDB();
//   try {
//     const appointment = await Appointment.findOneAndDelete({
//       _id: id,
//       clinicId,
//     });
//     if (!appointment) throw new Error("Appointment not found");
//     return { message: "Appointment deleted successfully" };
//   } catch (error) {
//     throw new Error(`Error deleting appointment: ${(error as Error).message}`);
//   }
// }
