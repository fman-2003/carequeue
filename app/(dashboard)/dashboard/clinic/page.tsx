/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getToken, saveToken } from "@/lib/auth/getSession";
import ConfirmModal from "@/components/ConfirmModal";

const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const WORKING_DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export default function CreateClinicPage() {
  const [existingClinic, setExistingClinic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    state: "",
    lga: "",
    openingTime: "08:00",
    closingTime: "17:00",
    slotDurationMinutes: 30,
    workingDays: [1, 2, 3, 4, 5] as number[],
  });

  useEffect(() => {
    /**
     * Check if admin already has a clinic.
     * Admins are limited to one clinic.
     * If they have one, show it instead of the create form.
     */
    fetch("/api/clinics/mine", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clinic) setExistingClinic(data.clinic);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleWorkingDay(day: number) {
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(day)
        ? f.workingDays.filter((d) => d !== day)
        : [...f.workingDays, day].sort(),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create clinic");
        return;
      }

      if (data.token) {
        saveToken(data.token);
      }

      setSuccess("Clinic created successfully ✅");
      setExistingClinic(data.clinic);
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;

  // admin already has a clinic — show it
  if (existingClinic) {
    return (
      <div className="max-w-lg">
        <h2 className="text-xl font-bold text-gray-800 mb-6">My Clinic</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Name
            </p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {existingClinic.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Address
            </p>
            <p className="text-gray-700 mt-0.5">{existingClinic.address}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              State / LGA
            </p>
            <p className="text-gray-700 mt-0.5">
              {existingClinic.state} · {existingClinic.lga}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Hours
            </p>
            <p className="text-gray-700 mt-0.5">
              {existingClinic.openingTime} — {existingClinic.closingTime}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Slot Duration
            </p>
            <p className="text-gray-700 mt-0.5">
              {existingClinic.slotDurationMinutes} minutes
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Working Days
            </p>
            <div className="flex gap-2 mt-1 flex-wrap">
              {WORKING_DAYS.filter((d) =>
                existingClinic.workingDays.includes(d.value),
              ).map((d) => (
                <span
                  key={d.value}
                  className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs"
                >
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Create Clinic</h2>
      <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3 mb-4">
        <p className="text-sm text-amber-700">
          ⚠️ You can only create one clinic and cannot edit it after creation.
          Please fill in the details carefully.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form
        // onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clinic Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="e.g. CareQueue General Hospital"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="e.g. 12 Hospital Road"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="+2348012345678"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="clinic@email.com"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <select
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            >
              <option className="text-black" value="">
                Select state
              </option>
              {NIGERIAN_STATES.map((s) => (
                <option className="text-black" key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LGA
            </label>
            <input
              type="text"
              value={form.lga}
              onChange={(e) => setForm({ ...form, lga: e.target.value })}
              className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. Ilorin South"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opening Time
            </label>
            <input
              type="time"
              value={form.openingTime}
              onChange={(e) =>
                setForm({ ...form, openingTime: e.target.value })
              }
              className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Closing Time
            </label>
            <input
              type="time"
              value={form.closingTime}
              onChange={(e) =>
                setForm({ ...form, closingTime: e.target.value })
              }
              className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slot Duration (minutes)
          </label>
          <select
            value={form.slotDurationMinutes}
            onChange={(e) =>
              setForm({ ...form, slotDurationMinutes: Number(e.target.value) })
            }
            className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {[15, 20, 30, 45, 60].map((d) => (
              <option className="text-black" key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Working Days
          </label>
          <div className="flex gap-2 flex-wrap">
            {WORKING_DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWorkingDay(day.value)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  form.workingDays.includes(day.value)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? "Creating..." : "Create Clinic"}
        </button>
      </form>
      {showCreateModal && (
        <ConfirmModal
          title="Create Clinic"
          message="Once created, your clinic details cannot be edited. Please review everything carefully before confirming."
          confirmText="Yes, Create Clinic"
          onConfirm={() => {
            setShowCreateModal(false);
            handleSubmit(new Event("submit") as any);
          }}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
