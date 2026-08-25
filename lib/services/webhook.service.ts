/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Waitlist from "@/lib/models/Waitlist";
import Appointment from "@/lib/models/Appointment";
import Clinic from "@/lib/models/Clinic";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { notificationTemplates } from "@/lib/notifications/templates";
import {
  respondToWaitlist,
  triggerWaitlist,
} from "@/lib/services/waitlist.service";

interface IncomingMessage {
  phone: string;
  command: string;
}

export async function handleIncomingWhatsApp({
  phone,
  command,
}: IncomingMessage) {
  await connectDB();

  // find patient by phone number as it is our only link
  const patient = await User.findOne({ phone }).lean();

  if (!patient) {
    // unknown number — send a helpful reply
    await sendWhatsAppMessage({
      to: phone,
      message: `We couldn't find an account linked to this number. Please contact your clinic directly.`,
    });
    return;
  }

  // ACCEPT — patient accepting an open waitlist slot
  async function handleAccept(patient: any) {
    /**
     * we find the most recent waitlist entry for this patient
     * that is in notified status, that means we sent them
     * a slot offer and are waiting for their response.
     * we sort by notifiedAt descending in case there are
     * multiple notifications (take the most recent one).
     */
    const entry = await Waitlist.findOne({
      patientId: patient._id,
      status: "notified",
    }).sort({ notifiedAt: -1 });

    if (!entry) {
      await sendWhatsAppMessage({
        to: patient.phone,
        message: `Hi ${patient.name}, we don't have an active slot offer for you right now.`,
      });
      return;
    }

    // delegate to the existing respondToWaitlist service
    // which handles expiry check, conflict check, and appointment creation
    try {
      await respondToWaitlist(
        entry._id.toString(),
        patient._id.toString(),
        "ACCEPT",
      );
    } catch (err: any) {
      await sendWhatsAppMessage({
        to: patient.phone,
        message: `Sorry ${patient.name}, ${err.message}`,
      });
    }
  }

  switch (command) {
    case "ACCEPT":
      await handleAccept(patient);
      break;

    case "DECLINE":
      await handleDecline(patient);
      break;

    case "CONFIRM":
      await handleConfirm(patient);
      break;

    case "CANCEL":
      await handleCancel(patient);
      break;

    default:
      // if patient sends an unkown command, we send back
      // a menu of valid options they can choose from
      const notification = notificationTemplates.unknownCommand(patient.name);
      await sendWhatsAppMessage({
        to: phone,
        message: notification.message,
        buttons: notification.buttons,
      });
  }
}

// DECLINE — patient decilnes a waitlist slot
async function handleDecline(patient: any) {
  const entry = await Waitlist.findOne({
    patientId: patient._id,
    status: "notified",
  }).sort({ notifiedAt: -1 });

  if (!entry) {
    await sendWhatsAppMessage({
      to: patient.phone,
      message: `Hi ${patient.name}, we don't have an active slot offer for you to decline.`,
    });
    return;
  }

  try {
    await respondToWaitlist(
      entry._id.toString(),
      patient._id.toString(),
      "DECLINE",
    );

    // await sendWhatsAppMessage({
    //   to: patient.phone,
    //   message: `Understood ${patient.name}. We'll notify you if another slot opens up. 👍`,
    // });
  } catch (err: any) {
    await sendWhatsAppMessage({
      to: patient.phone,
      message: `Sorry ${patient.name}, ${err.message}`,
    });
  }
}

// CONFIRM — patient confirms attendance
async function handleConfirm(patient: any) {
  /**
   * we find their next upcoming appointment that is
   * still in pending status (not yet confirmed).
   * we scope by future dates only so we don't accidentally
   * confirm a past appointment.
   */
  const appointment = await Appointment.findOne({
    patientId: patient._id,
    status: "pending",
    date: { $gte: new Date() },
  })
    .sort({ date: 1 })
    .populate("clinicId", "name");

  if (!appointment) {
    await sendWhatsAppMessage({
      to: patient.phone,
      message: `Hi ${patient.name}, we couldn't find a pending appointment to confirm. Please contact your clinic if you think this is an error.`,
    });
    return;
  }

  await Appointment.findByIdAndUpdate(appointment._id, { status: "confirmed" });

  // const clinic = appointment.clinicId as any;
  // const formattedDate = new Date(appointment.date).toDateString();

  // const notification = notificationTemplates.appointmentConfirmedByDoctor(
  //   patient.name,
  //   formattedDate,
  //   appointment.timeSlot,
  //   clinic?.name,

  // );
  // await sendWhatsAppMessage({
  //   to: patient.phone,
  //   message: notification.message,
  //   buttons: notification.buttons,
  // });
}

// CANCEL — patient cancels their appointment
async function handleCancel(patient: any) {
  /**
   * we find their nearest upcoming appointment that
   * can still be cancelled (pending or confirmed).
   * we do not allow cancelling appointments in the past
   * or ones already completed/no-show.
   */
  const appointment = await Appointment.findOne({
    patientId: patient._id,
    status: { $in: ["pending", "confirmed"] },
    date: { $gte: new Date() },
  })
    .sort({ date: 1 })
    .populate("clinicId", "name");

  if (!appointment) {
    await sendWhatsAppMessage({
      to: patient.phone,
      message: `Hi ${patient.name}, we couldn't find an upcoming appointment to cancel.`,
    });
    return;
  }

  const previousStatus = appointment.status;
  /**
   * We use findByIdAndUpdate directly here rather than
   * calling updateAppointment() from the service because
   * updateAppointment() requires clinicId scoping which
   * we don't have in this context — and the cancellation
   * notification + waitlist trigger needs to fire too.
   * We do that manually below to keep full control.
   */
  await Appointment.findByIdAndUpdate(appointment._id, { status: "cancelled" });

  // const clinic = appointment.clinicId as any;
  // const formattedDate = new Date(appointment.date).toDateString();

  // notify the patient their cancellation was processed
  // await sendWhatsAppMessage({
  //   to: patient.phone,
  //   message: notificationTemplates.appointmentCancelledForPatient(
  //     patient.name,
  //     formattedDate,
  //     appointment.timeSlot,
  //     clinic?.name || "your clinic",
  //   ),
  // });

  // only trigger waitlist if the cancelled appointment was previously confirmed
  if (previousStatus === "confirmed" && appointment.doctorId) {
    const { triggerWaitlist } = await import("@/lib/services/waitlist.service");
    await triggerWaitlist(
      appointment.clinicId.toString(),
      appointment.doctorId.toString(),
      appointment.date,
      appointment.timeSlot,
    );
  }
}

export async function handleButtonPayload({
  phone,
  payload,
}: {
  phone: string;
  payload: string;
}) {
  await connectDB();

  /**
   * Payload format: "ACTION:id"
   */
  const colonIndex = payload.indexOf(":");
  if (colonIndex === -1) {
    console.error("Invalid button payload format:", payload);
    return;
  }

  const action = payload.substring(0, colonIndex).toUpperCase();
  const id = payload.substring(colonIndex + 1);

  const phoneVariants = [
    phone,
    phone.replace("+", ""),
    phone.replace("+234", "0"),
  ];

  const user = await User.findOne({ phone: { $in: phoneVariants } }).lean();

  if (!user) {
    await sendWhatsAppMessage({
      to: phone,
      message: `We couldn't find an account linked to this number. Please contact your clinic directly.`,
    });
    return;
  }

  switch (action) {
    case "CANCEL":
      await handleButtonCancel(user, id);
      break;

    case "DOCCONFIRM":
      await handleDoctorConfirm(user, id);
      break;

    case "DOCCANCEL":
      await handleDoctorCancel(user, id);
      break;

    case "ACCEPT":
      await handleButtonAccept(user, id);
      break;

    case "DECLINE":
      await handleButtonDecline(user, id);
      break;

    default:
      console.error("Unknown button action:", action);
  }
}

async function handleButtonCancel(user: any, appointmentId: string) {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patientId: user._id,
    status: { $in: ["pending", "confirmed"] },
  });

  if (!appointment) {
    await sendWhatsAppMessage({
      to: user.phone,
      message: `Hi ${user.name}, we couldn't find that appointment or it may already be cancelled.`,
    });
    return;
  }

  const previousStatus = appointment.status;
  await Appointment.findByIdAndUpdate(appointmentId, { status: "cancelled" });

  const [clinic] = await Promise.all([
    Clinic.findById(appointment.clinicId).lean(),
  ]);

  const notification = notificationTemplates.appointmentCancelledForPatient(
    user.name,
    new Date(appointment.date).toDateString(),
    appointment.timeSlot,
    clinic?.name || "your clinic",
  );

  await sendWhatsAppMessage({
    to: user.phone,
    message: notification.message,
    buttons: notification.buttons,
  });

  if (previousStatus === "confirmed" && appointment.doctorId) {
    await triggerWaitlist(
      appointment.clinicId.toString(),
      appointment.doctorId.toString(),
      appointment.date,
      appointment.timeSlot,
    );
  }

  // remove waitlist entry
  await Waitlist.findOneAndUpdate(
    { appointmentId: appointment._id },
    { status: "removed" },
  );
}

// async function handleButtonConfirm(user: any, appointmentId: string) {
//   const appointment = await Appointment.findOne({
//     _id: appointmentId,
//     patientId: user._id,
//     status: "confirmed",
//   }).populate("clinicId", "name");

//   if (!appointment) {
//     await sendWhatsAppMessage({
//       to: user.phone,
//       message: `Hi ${user.name}, we couldn't find that appointment or it may no longer need confirmation.`,
//     });
//     return;
//   }

//   const clinic = appointment.clinicId as any;

//   await sendWhatsAppMessage({
//     to: user.phone,
//     message: `✅ Got it ${user.name}! See you at *${clinic?.name}* on ${new Date(appointment.date).toDateString()} at ${appointment.timeSlot}.`,
//   });
// }

async function handleDoctorConfirm(user: any, appointmentId: string) {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    doctorId: user._id,
    status: "pending",
  });

  if (!appointment) {
    await sendWhatsAppMessage({
      to: user.phone,
      message: `Hi Dr. ${user.name}, that appointment is no longer pending.`,
    });
    return;
  }

  await Appointment.findByIdAndUpdate(appointmentId, { status: "confirmed" });

  // notify patient their appointment is confirmed
  const [patient, clinic] = await Promise.all([
    User.findById(appointment.patientId).lean(),
    Clinic.findById(appointment.clinicId).lean(),
  ]);

  if (patient?.phone && clinic) {
    const notification = notificationTemplates.appointmentConfirmedByDoctor(
      patient.name,
      new Date(appointment.date).toDateString(),
      appointment.timeSlot,
      clinic.name,
      appointment._id.toString(),
    );

    await sendWhatsAppMessage({
      to: patient.phone,
      message: notification.message,
      buttons: notification.buttons,
    });
  }

  await sendWhatsAppMessage({
    to: user.phone,
    message: `✅ Appointment confirmed for ${patient?.name || "patient"} on ${new Date(appointment.date).toDateString()} at ${appointment.timeSlot}.`,
  });
}

async function handleDoctorCancel(user: any, appointmentId: string) {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    doctorId: user._id,
    status: { $in: ["pending", "confirmed"] },
  });

  if (!appointment) {
    await sendWhatsAppMessage({
      to: user.phone,
      message: `Hi Dr. ${user.name}, that appointment couldn't be found or is already cancelled.`,
    });
    return;
  }

  const previousStatus = appointment.status;
  await Appointment.findByIdAndUpdate(appointmentId, { status: "cancelled" });

  const [patient, clinic] = await Promise.all([
    User.findById(appointment.patientId).lean(),
    Clinic.findById(appointment.clinicId).lean(),
  ]);

  // notify patient
  if (patient?.phone && clinic) {
    const notification = notificationTemplates.appointmentCancelledForPatient(
      patient.name,
      new Date(appointment.date).toDateString(),
      appointment.timeSlot,
      clinic.name,
    );
    await sendWhatsAppMessage({
      to: patient.phone,
      message: notification.message,
      buttons: notification.buttons,
    });
  }

  await sendWhatsAppMessage({
    to: user.phone,
    message: `Appointment with ${patient?.name || "patient"} on ${new Date(appointment.date).toDateString()} at ${appointment.timeSlot} has been cancelled.`,
  });

  if (previousStatus === "confirmed") {
    await triggerWaitlist(
      appointment.clinicId.toString(),
      appointment.doctorId.toString(),
      appointment.date,
      appointment.timeSlot,
    );
  }

  await Waitlist.findOneAndUpdate(
    { appointmentId: appointment._id },
    { status: "removed" },
  );
}

async function handleButtonAccept(user: any, waitlistId: string) {
  try {
    const result = await respondToWaitlist(
      waitlistId,
      user._id.toString(),
      "ACCEPT",
    );
    // respondToWaitlist handles all notifications internally
    void result;
  } catch (err: any) {
    await sendWhatsAppMessage({
      to: user.phone,
      message: `Sorry ${user.name}, ${err.message}`,
    });
  }
}

async function handleButtonDecline(user: any, waitlistId: string) {
  try {
    await respondToWaitlist(waitlistId, user._id.toString(), "DECLINE");

    await sendWhatsAppMessage({
      to: user.phone,
      message: `Understood ${user.name}. We'll notify you if another slot opens up. 👍`,
    });
  } catch (err: any) {
    await sendWhatsAppMessage({
      to: user.phone,
      message: `Sorry ${user.name}, ${err.message}`,
    });
  }
}
