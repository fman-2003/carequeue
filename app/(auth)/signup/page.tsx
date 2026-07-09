"use client";

import { useState } from "react";
import { useRouter, } from "next/navigation";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import Link from "next/link";
import Image from "next/image";
import { saveToken } from "@/lib/auth/getSession";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    role: "patient" as "patient" | "doctor" | "admin" | "receptionist",
    inviteCode: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          role: form.role,
        }),
      });

      const data = await res.json();

      console.log("Form data:", form);
      if (!res.ok) {
        setError(
          typeof data.error === "object"
            ? Object.values(data.error).flat().join(", ")
            : data.error || "Registration failed",
        );
        return;
      }
      saveToken(data.token);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 ">
      <Image
        src="/doctor-handling-patient.jpg"
        alt="Doctor handling patient"
        width={1000}
        height={1000}
        className="hidden md:hidden lg:flex w-1/2 min-h-screen"
      />
      <div className="w-full mx-auto max-w-md bg-white rounded-xl shadow-card px-8 py-4">
        <button
          onClick={() => router.push("/")}
          className="w-9 h-9 hover:text-neutral-500 flex items-center justify-center transition-colors"
        >
          <ArrowBackOutlinedIcon
            sx={{ fontSize: 20, color: "var(--color-text-neutral)" }}
          />{" "}
          Back
        </button>
        <h1 className="text-2xl font-bold text-neutral-800 mb-1">CareQueue</h1>
        <p className="text-neutral-500 text-sm mb-6">Create your account</p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              placeholder="e.g. Tunde Okafor"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Phone Number{" "}
              {/* <span className="text-neutral-400 font-normal"></span> */}
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass}
              placeholder="+2348012345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              I am signing up as
            </label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as typeof form.role })
              }
              className={inputClass}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              {/* <option value="receptionist">Receptionist</option> */}
              <option value="admin">Clinic Admin</option>
            </select>
            <p className="text-xs text-neutral-400 mt-1">
              {form.role === "patient" &&
                "Book appointments and manage your health visits."}
              {form.role === "doctor" &&
                "Manage your schedule and patient appointments."}
              {/* {form.role === "receptionist" &&
                "Book and manage appointments on behalf of doctors and patients."} */}
              {form.role === "admin" &&
                "Create and manage your clinic. You will set up your clinic after signing up."}
            </p>
          </div>
          {(form.role === "doctor" || form.role === "receptionist") && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Invite Code
                <span className="text-error ml-1">*</span>
              </label>
              <input
                type="text"
                value={form.inviteCode || ""}
                onChange={(e) =>
                  setForm({ ...form, inviteCode: e.target.value.toUpperCase() })
                }
                className={inputClass}
                placeholder="CQ-XXXXXXXX"
                required
              />
              <p className="text-xs text-neutral-400 mt-1">
                Get this code from your clinic admin.
              </p>
            </div>
          )}
          <div className="flex flex-row justify-between gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className={inputClass}
                placeholder="Repeat your password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 transition mt-2"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center text-neutral-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
