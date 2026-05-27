"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveToken } from "@/lib/auth/getSession";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    role: "patient" as "patient" | "doctor" | "receptionist" | "admin",
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

      /**
       * Save token immediately after registration —
       * user is logged in as soon as they sign up,
       * no need for a separate login step.
       */
      saveToken(data.token);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-10">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">CareQueue</h1>
        <p className="text-gray-500 text-sm mb-6">Create your account</p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number{" "}
              {/* <span className="text-gray-400 font-normal"></span> */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <option value="receptionist">Receptionist</option>
              <option value="admin">Clinic Admin</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {form.role === "patient" &&
                "Book appointments and manage your health visits."}
              {form.role === "doctor" &&
                "Manage your schedule and patient appointments."}
              {form.role === "receptionist" &&
                "Book and manage appointments on behalf of doctors and patients."}
              {form.role === "admin" &&
                "Create and manage your clinic. You will set up your clinic after signing up."}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition mt-2"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
