export const TOURS = {
  admin: {
    dashboard: [
      {
        title: "Welcome to your Clinic Overview 👋",
        content:
          "This is your admin dashboard. You can see a summary of all clinic activity — total appointments, no-show rates, and peak hours.",
      },
      {
        title: "Analytics Charts",
        content:
          "The charts below update in real time based on your clinic's appointment data. Use them to spot trends and make staffing decisions.",
      },
    ],
    appointments: [
      {
        title: "Clinic Appointments",
        content:
          "All appointments across your clinic are listed here. You have read-only access — status changes are made by doctors.",
      },
      {
        title: "Filter & Search",
        content:
          "Use the search bar to find a patient by name, filter by status, or sort by date to find what you need quickly.",
      },
    ],
    users: [
      {
        title: "Clinic Users",
        content:
          "All doctors and patients registered under your clinic appear here. Click any card to see their full details.",
      },
      {
        title: "Doctor Overview",
        content:
          "When you click a doctor, you can see their appointment metrics — completion rate, no-show rate, and active waitlist count.",
      },
    ],
  },
  doctor: {
    dashboard: [
      {
        title: "Your Schedule 👨‍⚕️",
        content:
          "Welcome to your doctor dashboard. Your today's appointments and monthly trend are always visible here.",
      },
      {
        title: "Risk Scores",
        content:
          "Every appointment is scored with a no-show risk percentage by our AI model. High-risk patients are automatically sent extra reminders.",
      },
    ],
    appointments: [
      {
        title: "Your Appointments",
        content:
          "Only your appointments appear here. Use the action buttons to confirm, complete, or mark patients as no-shows.",
      },
      {
        title: "Visit Records",
        content:
          'After marking an appointment as completed, an "Add Notes" button appears. Use it to record clinical notes, prescriptions, and vitals.',
      },
    ],
    "my-patients": [
      {
        title: "My Patients",
        content:
          "Patients who have selected you as their preferred doctor appear here. Click any patient to view their full medical profile and visit history.",
      },
    ],
  },
  patient: {
    dashboard: [
      {
        title: "Your Health Dashboard 🏥",
        content:
          "Welcome to CareQueue. Your upcoming appointments and doctor info are always visible here.",
      },
      {
        title: "Doctor Card",
        content:
          "If you have a preferred doctor set, their contact info appears in the top left. Go to Settings to set or change your preferred doctor.",
      },
    ],
    appointments: [
      {
        title: "Your Appointments",
        content:
          "All your bookings are listed here. Click any row to see the full details including reason for visit.",
      },
      {
        title: "Cancelling",
        content:
          "You can cancel a pending or confirmed appointment using the Cancel button. A cancellation may open a slot for a patient on the waitlist.",
      },
    ],
    waitlist: [
      {
        title: "The Waitlist 📋",
        content:
          "When you join the waitlist for a confirmed appointment, you'll be notified via WhatsApp if an earlier slot opens with your doctor.",
      },
      {
        title: "45-Minute Window",
        content:
          "When you receive an offer, you have 45 minutes to accept or decline via WhatsApp. The countdown appears on your waitlist card.",
      },
    ],
    health: [
      {
        title: "Your Health Profile 🩺",
        content:
          "Fill in your blood group, allergies, chronic conditions, and emergency contact here. Your doctor sees this before every consultation.",
      },
    ],
    "my-records": [
      {
        title: "Your Visit Records",
        content:
          "After each completed appointment, your doctor adds a visit summary. You can see your diagnosis, prescriptions, and lab tests ordered here.",
      },
    ],
  },
};
