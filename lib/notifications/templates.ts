export const notificationTemplates = {
  appointmentBookedForPatient: (
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
    appointmentId: string,
  ) => ({
    message: `Hello ${patientName} 👋\n\nYour appointment at *${clinicName}* has been booked.\n\n📅 Date: ${date}\n⏰ Time: ${timeSlot}\n\nAwaiting confirmation or cancellation from your doctor.`,
    buttons: [{ id: `CANCEL:${appointmentId}`, title: "Cancel Appointment" }],
  }),
  appointmentBookedForDoctor: (
    doctorName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
    appointmentId: string,
  ) => ({
    message: `Hello Dr. ${doctorName} 👋\n\nNew appointment request at *${clinicName}*\n\n📅 ${date} at ⏰ ${timeSlot}`,
    buttons: [
      { id: `DOCCONFIRM:${appointmentId}`, title: "Confirm Appointment" },
      { id: `DOCCANCEL:${appointmentId}`, title: "Cancel Appointment" },
    ],
  }),
  appointmentCancelledForPatient: (
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
  ) => ({
    message: `Hello ${patientName},\n\nYour appointment at *${clinicName}* on ${date} at ${timeSlot} has been cancelled.`,
    buttons: [],
  }),
  appointmentCancelledForDoctor: (
    doctorName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
  ) => ({
    message: `Hello Dr. ${doctorName} 👋\n\nAppointment at *${clinicName}* on ${date} at ${timeSlot} has been cancelled. The slot is now free.`,
    buttons: [],
  }),
  appointmentCompletedForPatient: (
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
  ) => ({
    message: `Hi ${patientName} 👋\n\nThank you for visiting *${clinicName}* today.\n\n📅 ${date} at ⏰ ${timeSlot}\n\nWe hope you received great care!`,
    buttons: [],
  }),
  appointmentCompletedForDoctor: (
    doctorName: string,
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
  ) => ({
    message: `Hi Dr. ${doctorName} 👋\n\nAppointment with *${patientName}* at *${clinicName}* marked as completed.\n\n📅 ${date} at ⏰ ${timeSlot}`,
    buttons: [],
  }),
  appointmentNoShowForPatient: (
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
  ) => ({
    message: `Hi ${patientName},\n\nWe noticed you missed your appointment at *${clinicName}*.\n\n📅 ${date} at ⏰ ${timeSlot}\n\nWe understand things come up. 
    You can contact your doctor to reschedule at a time that works better for you or you can book a new appointment directly from the CareQueue site. 🙏`,
    buttons: [],
  }),
  appointmentNoShowForDoctor: (
    doctorName: string,
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
  ) => ({
    message: `Hi Dr. ${doctorName} 👋\n\n*${patientName}* did not show up for their appointment at *${clinicName}*.\n\n📅 ${date} at ⏰ ${timeSlot}\n\nThe slot has been successfully marked as a no-show.`,
    buttons: [],
  }),
  appointmentConfirmedByDoctor: (
    userName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
    appointmentId: string, // ← new param
  ) => ({
    message: `Hi ${userName} 👋\n\n✅ Appointment confirmed at *${clinicName}*\n\n📅 ${date} at ⏰ ${timeSlot}`,
    buttons: [
      // { id: `CONFIRM:${appointmentId}`, title: "Confirm Attendance" },
      { id: `CANCEL:${appointmentId}`, title: "Cancel Appointment" },
    ],
  }),
  appointmentReminder: (
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
    appointmentId: string,
  ) => ({
    message: `Hi ${patientName} 👋, this is a reminder about your appointment at *${clinicName}*.\n\n📅 ${date} at ⏰ ${timeSlot}\n\nPress *CANCEL* to cancel if needed.`,
    buttons: [{ id: `CANCEL:${appointmentId}`, title: "Cancel Appointment" }],
  }),
  waitlistNotification: (
    patientName: string,
    doctorName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
    waitlistId: string,
  ) => ({
    message: `Great news ${patientName} 🎉\n\nAn earlier slot opened at *${clinicName}* with Dr. ${doctorName}!\n\n📅 ${date}\n⏰ ${timeSlot}\n\n⏳ You have *45 minutes* to respond.`,
    buttons: [
      { id: `ACCEPT:${waitlistId}`, title: "Accept Slot" },
      { id: `DECLINE:${waitlistId}`, title: "Decline Slot" },
    ],
  }),
  waitlistJoined: (patientName: string, doctorName: string, position: number) => ({
    message: `Hi ${patientName} 👋\n\nYou've been added to Dr. ${doctorName}'s waitlist.\n\n📋 Your position: *#${position}*\n\nWe'll notify you if an earlier slot opens up.`,
    buttons: [],
  }),
  highRiskReminder: (
    patientName: string,
    date: string,
    timeSlot: string,
    clinicName: string,
    appointmentId: string,
  ) => ({
    message: `Hi ${patientName} 👋\n\nJust checking in — your appointment at *${clinicName}* on ${date} at ${timeSlot} is coming up.\n\nPlease let us know if your plans change.`,
    buttons: [
      // { id: `CONFIRM:${appointmentId}`, title: "Confirm Attendance" },
      { id: `CANCEL:${appointmentId}`, title: "Cancel Appointment" },
    ],
  }),
  unknownCommand: (userName: string) => ({
    message: `Hi ${userName} 👋\n\nSorry, I didn't understand that. Please use the action buttons on the original message to respond.`,
    buttons: [],
  }),
};
