/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import Link from "next/link";
import { getSessionField } from "@/lib/auth/getSession";
import ClinicGuard from "@/components/ClinicGuard";
import PageWrapper from "@/components/layout/PageWrapper";

// Reads the cached session hint that the dashboard layout refreshes
// from the server. UI convenience only: every API route re-derives
// role, clinic, and identity from the signed session cookie.
function getFromToken(field: string): string {
  return getSessionField(field);
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const role = getFromToken("role");
  const userId = getFromToken("userId");
  const clinicId = getFromToken("clinicId");

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [preferredDoctorId, setPreferredDoctorId] = useState<string>("");
  const [preferredDoctorName, setPreferredDoctorName] = useState<string>("");
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    date: "",
    timeSlot: "",
    reason: "",
    clinicId: clinicId || "",
  });

  if (role === "patient" && !clinicId) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-gray-500 text-sm text-center max-w-sm">
            You need to set a clinic in settings before booking an appointment.
          </p>
          <Link
            href="/dashboard/settings"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Go to Settings →
          </Link>
        </div>
      </PageWrapper>
    );
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, profileRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/users/me"),
        ]);

        const usersData = await usersRes.json();
        const profileData = await profileRes.json().catch(() => null);

        if (role === "patient") {
          setDoctors(usersData.doctors || []);

          const preferred = profileData?.user?.preferredDoctorId;

          if (preferred) {
            const prefId =
              preferred?._id?.toString() || preferred?.toString() || "";
            const prefName =
              preferred?.name ||
              usersData.doctors?.find((d: any) => d._id === prefId)?.name ||
              "";

            setPreferredDoctorId(prefId);
            setPreferredDoctorName(prefName);
            setForm((f) => ({
              ...f,
              patientId: userId,
              doctorId: prefId,
            }));
          } else {
            setForm((f) => ({ ...f, patientId: userId }));
          }
        }

        if (role === "doctor") {
          setPatients(usersData.patients || []);
          setForm((f) => ({
            ...f,
            doctorId: userId,
          }));
        }

        if (role === "receptionist") {
          setPatients(usersData.patients || []);
          setDoctors(usersData.doctors || []);
        }
      } catch {
        setError("Failed to load form data");
      }
    }

    fetchData();
  }, [role, userId]);

  useEffect(() => {
    const effectiveClinicId = form.clinicId || clinicId;
    if (!form.doctorId || !form.date || !effectiveClinicId) return;

    setFetchingSlots(true);
    setSlots([]);
    setForm((f) => ({ ...f, timeSlot: "" }));

    fetch(
      `/api/clinics/${effectiveClinicId}/slots?doctorId=${form.doctorId}&date=${form.date}`,
    )
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []))
      .catch(() => setError("Failed to load available slots"))
      .finally(() => setFetchingSlots(false));
  }, [form.doctorId, form.date, form.clinicId, clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          clinicId: form.clinicId || clinicId,
          date: new Date(form.date).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        return;
      }

      router.push("/dashboard/appointments");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const availableSlots = slots.filter((s) => s.available);

  const inputClass =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm text-black";

  return (
    <PageWrapper>
      <div className="max-w-lg">
        <ClinicGuard hasClinic={!!clinicId} role={role}>
          <button
            onClick={() => router.back()}
            className="w-9 h-9 hover:text-neutral-500 flex items-center justify-center transition-colors"
          >
            <ArrowBackOutlinedIcon
              sx={{ fontSize: 20, color: "var(--color-text-neutral)" }}
            />{" "}
            Back
          </button>
          {error && clinicId ? (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : null}
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4"
          >
            {(role === "doctor" || role === "receptionist") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient
                </label>
                <select
                  value={form.patientId}
                  onChange={(e) =>
                    setForm({ ...form, patientId: e.target.value })
                  }
                  className={inputClass}
                  required
                >
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role !== "doctor" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor
                  {role === "patient" && preferredDoctorId && (
                    <span className="ml-2 text-xs text-blue-500 font-normal">
                      (preferred doctor)
                    </span>
                  )}
                </label>

                {role === "patient" && preferredDoctorId ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={preferredDoctorName}
                      disabled
                      className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-black cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      To change your doctor,{" "}
                      <Link
                        href="/dashboard/settings"
                        className="text-blue-500 hover:underline"
                      >
                        update your settings
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <select
                    value={form.doctorId}
                    onChange={(e) =>
                      setForm({ ...form, doctorId: e.target.value })
                    }
                    className={inputClass}
                    required
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Slot
                {fetchingSlots && (
                  <span className="ml-2 text-xs text-gray-400">
                    Loading slots...
                  </span>
                )}
              </label>

              {form.doctorId &&
                form.date &&
                !fetchingSlots &&
                availableSlots.length === 0 && (
                  <p className="text-sm text-red-500">
                    No available slots for this doctor on this date.
                  </p>
                )}

              {availableSlots.length > 0 && (
                <select
                  value={form.timeSlot}
                  onChange={(e) =>
                    setForm({ ...form, timeSlot: e.target.value })
                  }
                  className={inputClass}
                  required
                >
                  <option value="">Select a slot</option>
                  {availableSlots.map((s) => (
                    <option key={s.timeSlot} value={s.timeSlot}>
                      {s.timeSlot}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className={inputClass}
                rows={3}
                placeholder="Brief reason for visit"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !form.timeSlot}
              className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? "Booking..." : "Book Appointment"}
            </button>
          </form>
        </ClinicGuard>
      </div>
    </PageWrapper>
  );
}
