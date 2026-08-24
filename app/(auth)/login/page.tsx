/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveToken } from "@/lib/auth/getSession";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewPage, setViewPage] = useState(false);

  useEffect(() => {
    const viewPageTimer = setTimeout(() => {
      setViewPage(true);
    }, 4000);

    return () => clearTimeout(viewPageTimer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      saveToken(data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // viewPage && (
      <main className="min-h-screen flex items-center bg-neutral-50">
        <Image
          src="/doctor-talking-to-patient.jpg"
          alt="Doctor talking to patient"
          width={500}
          height={100}
          className="hidden md:hidden lg:flex w-1/2 min-h-screen"
          loading="lazy"
        />
        <div className="w-full mx-auto max-w-md bg-white rounded-xl shadow-card p-8">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 hover:text-neutral-500 flex items-center justify-center transition-colors"
          >
            <ArrowBackOutlinedIcon
              sx={{ fontSize: 20, color: "var(--color-text-neutral)" }}
            />{" "}
            Back
          </button>
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">
            CareQueue
          </h1>
          <p className="text-neutral-500 mb-6">Sign in to your account</p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="text-black w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="uith@carequeue.com"
                // required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="text-black w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                // required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 transition"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p className="text-sm text-center text-neutral-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary-600 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    // )
  );
}
