"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@mui/material/Button";
import Slide from "@mui/material/Slide";
import useScrollTrigger from "@mui/material/useScrollTrigger";
import { motion } from "motion/react";
import { styles } from "../app/styles";

function HideOnScroll({ children }: { children: React.ReactElement }) {
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}

function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <HideOnScroll>
      <nav className="fixed top-0 left-0 right-0 z-54 bg-white/80 backdrop-blur-md border-b border-neutral-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              {/* <span className="text-white font-bold text-sm">CQ</span> */}
            </div>
            <span className="font-bold text-lg text-neutral-900">
              CareQueue
            </span>
          </Link>
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Features", href: "#features" },
              { label: "How it Works", href: "#how-it-works" },
              { label: "Roles", href: "#roles" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-neutral-600 hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-neutral-700 hover:text-primary transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <button className={`${styles.btnPrimary} rounded-4xl`}>
              <Link href="/signup" className="text-sm py-2 px-2">
                Get Started for free
              </Link>
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="w-5 h-0.5 bg-neutral-700 mb-1.5" />
            <div className="w-5 h-0.5 bg-neutral-700 mb-1.5" />
            <div className="w-5 h-0.5 bg-neutral-700" />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-white px-6 py-4 flex flex-col gap-4">
            {["Features", "How it Works", "Roles"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-neutral-700 font-medium"
              >
                {item}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-2 border-t border-neutral-100">
              <Link
                href="/login"
                className="text-sm text-center border border-neutral-200 rounded-lg py-2.5 text-neutral-700"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="btn-primary text-sm text-center py-2.5"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </nav>
    </HideOnScroll>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-neutral-900 via-neutral-800 to-primary-900" />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse-slow" />
            <span className="text-secondary text-xs font-medium">
              Built for Nigerian Healthcare
            </span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Healthcare
            <span className="block bg-linear-to-r from-primary-300 to-secondary bg-clip-text text-transparent">
              Scheduling
            </span>
            Reimagined.
          </h1>

          <p className="text-lg text-neutral-300 leading-relaxed mb-8 max-w-xl">
            CareQueue connects patients, doctors, and clinics on one intelligent
            platform. Book appointments, manage queues, predict no-shows, and
            communicate via WhatsApp — all in one place.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              className={`${styles.btnPrimary} rounded-4xl shadow-primary`}
            >
              <Link href="/signup" className="text-sm py-2 px-2">
                Get Started for free
              </Link>
            </button>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 text-neutral-300 hover:text-white transition-colors py-3 px-6 text-sm font-medium"
            >
              See How It Works
            </a>
          </div>

          {/* Social proof numbers */}
          <div className="flex gap-8 mt-12 pt-8 border-t border-white/10">
            {[
              { value: "Role-based", label: "Admin, Doctor, Patient" },
              { value: "WhatsApp", label: "Native Integration" },
              { value: "AI-Powered", label: "Smart Scheduling" },
            ].map(({ value, label }) => (
              <div key={value}>
                <p className="text-white font-bold text-lg">{value}</p>
                <p className="text-neutral-400 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — dashboard mockup */}
        <div className="relative hidden lg:block">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-strong">
            {/* Fake app bar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white text-sm font-semibold">
                  Good morning, Dr. Okafor
                </p>
                <p className="text-neutral-400 text-xs">
                  Today&apos;s schedule overview
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-primary" />
            </div>

            {/* Fake stat cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                {
                  label: "Today",
                  value: "8",
                  color: "text-primary-300",
                },
                {
                  label: "Pending",
                  value: "3",
                  color: "text-amber-300",
                },
                {
                  label: "Waitlist",
                  value: "12",
                  color: "text-cyan-300",
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3">
                  <p className="text-neutral-400 text-xs">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Fake appointment rows */}
            {[
              {
                name: "Amaka Obi",
                time: "09:00",
                status: "confirmed",
                risk: "Low",
              },
              {
                name: "Tunde Adeola",
                time: "09:30",
                status: "pending",
                risk: "High",
              },
              {
                name: "Ngozi Chukwu",
                time: "10:00",
                status: "confirmed",
                risk: "Low",
              },
            ].map((appt) => (
              <div
                key={appt.name}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {appt.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {appt.name}
                    </p>
                    <p className="text-neutral-400 text-xs">{appt.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      appt.status === "confirmed"
                        ? "bg-success/20 text-green-300"
                        : "bg-accent/20 text-amber-300"
                    }`}
                  >
                    {appt.status}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      appt.risk === "Low"
                        ? "bg-success/10 text-green-400"
                        : "bg-error/20 text-red-300"
                    }`}
                  >
                    {appt.risk} risk
                  </span>
                </div>
              </div>
            ))}

            {/* WhatsApp notification mockup */}
            <div className="mt-4 bg-success/10 border border-success/20 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center text-white text-xs">
                WA
              </div>
              <div>
                <p className="text-green-300 text-xs font-medium">
                  WhatsApp sent
                </p>
                <p className="text-neutral-400 text-xs">
                  Hey Amaka Obi, your appointment with Dr. Okafor at 9:30 has
                  been confirmed!
                </p>
              </div>
            </div>
          </div>

          {/* Floating badge */}
          <div className="absolute -top-4 -right-4 bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-medium hover:animate-bounce-soft cursor-default">
            AI-Powered ✦
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemStatement() {
  const problems = [
    {
      icon: "⏳",
      title: "Patients wait hours",
      desc: "No digital queue management means patients arrive at 7am and wait until noon, not knowing when they'll be seen.",
    },
    {
      icon: "📋",
      title: "Paper records everywhere",
      desc: "Medical history stored in physical folders — misplaced, inaccessible, and impossible to share across visits.",
    },
    {
      icon: "📵",
      title: "No-shows drain revenue",
      desc: "Clinics have no way to predict which patients will show up, leading to empty slots and lost income.",
    },
    {
      icon: "📞",
      title: "Phone calls to book",
      desc: "Booking an appointment means calling the clinic, being put on hold, and hoping the receptionist wrote it down correctly.",
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-widest">
            The Problem
          </span>
          <h2 className="text-4xl font-bold text-neutral-900 mt-3 mb-4">
            Nigerian clinics are running on
            <span className="text-error"> broken systems.</span>
          </h2>
          <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
            Over 200 million people. A growing private healthcare sector. And
            almost no modern scheduling infrastructure at the clinic level.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map(({ icon, title, desc }) => (
            <motion.div
              whileHover={{ y: -5 }}
              key={title}
              className="card rounded-xl shadow-medium p-6 hover:shadow-medium hover:cursor-pointer bg-zinc-50"
            >
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="font-semibold text-neutral-800 mb-2">{title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: "📅",
      title: "Smart Appointment Booking",
      desc: "Patients book available slots in real time. Conflict detection prevents double-booking automatically.",
      color: "bg-primary-light",
      accent: "text-primary",
    },
    {
      icon: "🤖",
      title: "AI Scheduling Assistant",
      desc: "Patients describe what they need in plain English. CareQueue's AI finds the best matching slot and books it instantly.",
      color: "bg-secondary-light",
      accent: "text-secondary-dark",
    },
    {
      icon: "📲",
      title: "WhatsApp-First Notifications",
      desc: "Appointment confirmations, reminders, and cancellations sent directly to WhatsApp — where Nigerian patients actually are.",
      color: "bg-success-light",
      accent: "text-success",
    },
    {
      icon: "📊",
      title: "No-Show Prediction",
      desc: "A TensorFlow.js model scores every appointment with a risk probability, allowing proactive outreach before a no-show.",
      color: "bg-accent-light",
      accent: "text-accent-dark",
    },
    {
      icon: "🔄",
      title: "Intelligent Waitlist",
      desc: "When a confirmed appointment is cancelled, the next eligible patient on the waitlist is automatically offered the earlier slot.",
      color: "bg-primary-light",
      accent: "text-primary",
    },
    {
      icon: "🏥",
      title: "Built-in EHR",
      desc: "Doctors record clinical notes, vitals, prescriptions, and lab orders after each visit. Patients see a safe summary.",
      color: "bg-secondary-light",
      accent: "text-secondary-dark",
    },
  ];

  return (
    <section id="features" className="py-24 bg-neutral-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest">
            Features
          </span>
          <h2 className="text-4xl font-bold text-neutral-900 mt-3 mb-4">
            Everything a clinic <span className="text-accent">needs.</span>
            <br />
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            CareQueue is purpose-built for the Nigerian healthcare market
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon, title, desc, color, accent }) => (
            <div key={title} className="card-hover p-6">
              <div
                className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-2xl mb-5`}
              >
                {icon}
              </div>
              <h3 className="font-semibold text-neutral-800 mb-2 text-base">
                {title}
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Clinic registers",
      desc: "Admin creates the clinic, sets working hours, slot duration, and invites doctors and receptionists.",
      role: "Admin",
    },
    {
      step: "02",
      title: "Patients sign up",
      desc: "Patients create an account, select their clinic and preferred doctor, and fill in their health profile.",
      role: "Patient",
    },
    {
      step: "03",
      title: "Book an appointment",
      desc: "Patient picks a date and available time slot — or describes their need to the AI assistant in plain English.",
      role: "Patient",
    },
    {
      step: "04",
      title: "Doctor confirms",
      desc: "Doctor receives a WhatsApp notification and confirms or rejects the appointment with one tap.",
      role: "Doctor",
    },
    {
      step: "05",
      title: "Patient visits",
      desc: "On the appointment day, doctor records clinical notes, prescriptions, and follow-up instructions digitally.",
      role: "Doctor",
    },
    {
      step: "06",
      title: "Waitlist activates",
      desc: "If anyone cancels, the next eligible patient on the waitlist is automatically notified via WhatsApp within seconds.",
      role: "System",
    },
  ];

  const roleColors: Record<string, string> = {
    Admin: "bg-primary-light text-primary",
    Patient: "bg-secondary-light text-secondary-dark",
    Doctor: "bg-success-light text-success-text",
    System: "bg-accent-light text-accent-dark",
  };

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-widest">
            How It Works
          </span>
          <h2 className="text-4xl font-bold text-neutral-900 mt-3">
            From registration to first visit
            <span className="text-secondary"> in minutes.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map(({ step, title, desc, role }) => (
            <motion.div
              whileHover={{ scale: 1.05 }}
              key={step}
              className="shadow-card rounded-2xl hover:cursor-pointer bg-zinc-50 p-6 relative"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-4xl font-black text-neutral-400">
                  {step}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleColors[role]}`}
                >
                  {role}
                </span>
              </div>
              <h3 className="font-semibold text-neutral-800 mb-2">{title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForClinics() {
  const audiences = [
    {
      role: "For Patients",
      icon: "🧑‍⚕️",
      color: "border-t-primary",
      points: [
        "Book appointments from your phone in under 2 minutes",
        "Get WhatsApp confirmations and reminders automatically",
        "Join the waitlist for earlier slots when they open",
        "View your prescriptions, lab results, and visit history",
        "AI assistant finds the best slot based on your schedule",
      ],
    },
    {
      role: "For Doctors",
      icon: "👨‍⚕️",
      color: "border-t-secondary",
      points: [
        "See your full daily schedule at a glance",
        "Confirm or reject bookings directly from WhatsApp",
        "Know the no-show risk for every patient before they arrive",
        "Record clinical notes, prescriptions, and vitals digitally",
        "View complete patient health history before each consultation",
      ],
    },
    {
      role: "For Clinic Admins",
      icon: "🏥",
      color: "border-t-accent",
      points: [
        "Complete visibility across all clinic appointments",
        "Monitor doctor performance and no-show rates",
        "Manage all patients and staff from one dashboard",
        "Analytics dashboard showing trends and peak hours",
        "Zero manual coordination — waitlist runs automatically",
      ],
    },
  ];

  return (
    <section id="roles" className="py-24 bg-neutral-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest">
            Built for Everyone
          </span>
          <h2 className="text-4xl font-bold text-neutral-900 mt-3">
            One platform.
            <span className="text-primary"> Three experiences.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {audiences.map(({ role, icon, color, points }) => (
            <div
              key={role}
              className={`card p-6 hover:border-t-4 hover:cursor-pointer rounded-2xl bg-zinc-100 ${color} transition-all`}
            >
              <div className="text-4xl mb-3">{icon}</div>
              <h3 className="font-bold text-neutral-800 text-lg mb-5">
                {role}
              </h3>
              <ul className="flex flex-col gap-3">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="text-success mt-0.5 shrink-0">✓</span>
                    <span className="text-sm text-neutral-600">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24 bg-gradient-primary relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "30px 30px",
        }}
      />
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold text-black mb-4">
          Ready to modernise <span className="text-accent">your clinic?</span>
        </h2>
        <p className="text-neutral-500 text-lg mb-8 max-w-xl mx-auto">
          Join forward-thinking Nigerian clinics already using CareQueue to
          reduce no-shows, automate their waitlist, and delight their patients!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className={`${styles.btnPrimary} rounded-4xl transition-all`}>
            <Link href="/signup" className="text-sm py-2 px-2">
              Create a free account
            </Link>
          </button>
          <Link
            href="/login"
            className="border border-white/30 text-primary hover:underline font-medium py-3 px-8 rounded-lg hover:bg-white/10 transition-all"
          >
            Sign In →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-neutral-900 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center">
          <p className="text-xs text-neutral-500">
            © {new Date().getFullYear()} CareQueue. Built for Nigeria. By
            Fulfilment.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <Hero />
      <ProblemStatement />
      <Features />
      <HowItWorks />
      <ForClinics />
      <CTA />
      <Footer />
    </div>
  );
}
