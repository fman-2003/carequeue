/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getRole, getUserId } from "@/lib/auth/getSession";
import DocumentsSection from "@/components/ehr/DocumentsSection";
import PageTour from "@/components/ui/PageTour";
import { TOURS } from "@/lib/tour";
import PageWrapper from "@/components/layout/PageWrapper";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENOTYPES = ["AA", "AS", "SS", "AC", "SC"];

// Reads the cached session hint that the dashboard layout refreshes
// from the server. UI convenience only: every API route re-derives
// role, clinic, and identity from the signed session cookie.
function getRoleFromToken(): string {
  return getRole();
}

function getUserIdFromToken(): string {
  return getUserId();
}

export default function HealthProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // dynamic array fields
  const [newAllergy, setNewAllergy] = useState("");
  const [newCondition, setNewCondition] = useState("");
  const [newSurgery, setNewSurgery] = useState("");
  const [newFamily, setNewFamily] = useState("");

  useEffect(() => {
    fetch("/api/ehr/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile);
        if (data.profile) {
          setForm({
            ...data.profile,
            dateOfBirth: data.profile.dateOfBirth
              ? new Date(data.profile.dateOfBirth).toISOString().split("T")[0]
              : "",
          });
        } else {
          setForm({});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/ehr/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          dateOfBirth: form.dateOfBirth
            ? new Date(form.dateOfBirth).toISOString()
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }

      setProfile(data.profile);
      setMessage("Health profile updated ✅");
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function addToArray(field: string, value: string, clear: () => void) {
    if (!value.trim()) return;
    setForm((f: any) => ({
      ...f,
      [field]: [...(f[field] || []), value.trim()],
    }));
    clear();
  }

  function removeFromArray(field: string, index: number) {
    setForm((f: any) => ({
      ...f,
      [field]: f[field].filter((_: any, i: number) => i !== index),
    }));
  }

  const inputClass =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  if (loading) return;
  <PageWrapper>
    
    <p className="text-gray-500">Loading health profile...</p>
  </PageWrapper>;

  return (
    <PageWrapper>
      <div className="max-w-2xl">
        <PageTour tourId="patient-health" steps={TOURS.patient.health} />
        <p className="text-sm text-gray-500 mb-6">
          This information helps your doctor provide better care. Only your
          doctor and clinic can see this.
        </p>

        {message && (
          <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-6">
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Biometrics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>
                  Blood Group <span className="text-red-500 text-sm">*</span>
                </label>
                <select
                  value={form.bloodGroup || ""}
                  onChange={(e) =>
                    setForm({ ...form, bloodGroup: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Genotype <span className="text-red-500 text-sm">*</span>
                </label>
                <select
                  value={form.genotype || ""}
                  onChange={(e) =>
                    setForm({ ...form, genotype: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {GENOTYPES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Date of Birth <span className="text-red-500 text-sm">*</span>
                </label>
                <input
                  type="date"
                  value={
                    form.dateOfBirth
                      ? new Date(form.dateOfBirth).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    setForm({ ...form, dateOfBirth: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Gender <span className="text-red-500 text-sm">*</span>
                </label>
                <select
                  value={form.gender || ""}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Height (cm) <span className="text-red-500 text-sm">*</span>
                </label>
                <input
                  type="number"
                  value={form.height || ""}
                  onChange={(e) =>
                    setForm({ ...form, height: Number(e.target.value) })
                  }
                  className={inputClass}
                  placeholder="e.g. 170"
                />
              </div>

              <div>
                <label className={labelClass}>
                  Weight (kg) <span className="text-red-500 text-sm">*</span>
                </label>
                <input
                  type="number"
                  value={form.weight || ""}
                  onChange={(e) =>
                    setForm({ ...form, weight: Number(e.target.value) })
                  }
                  className={inputClass}
                  placeholder="e.g. 70"
                />
              </div>
            </div>
          </section>
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Medical History
            </h3>
            <div className="mb-4">
              <label className={labelClass}>Allergies</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addToArray("allergies", newAllergy, () =>
                        setNewAllergy(""),
                      );
                    }
                  }}
                  className={inputClass}
                  placeholder="e.g. Penicillin — press Enter to add"
                />
                <button
                  type="button"
                  onClick={() =>
                    addToArray("allergies", newAllergy, () => setNewAllergy(""))
                  }
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.allergies || []).map((a: string, i: number) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2 py-1 rounded-full"
                  >
                    {a}
                    <button
                      onClick={() => removeFromArray("allergies", i)}
                      className="hover:text-red-900"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className={labelClass}>Chronic Conditions</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addToArray("chronicConditions", newCondition, () =>
                        setNewCondition(""),
                      );
                    }
                  }}
                  className={inputClass}
                  placeholder="e.g. Type 2 Diabetes — press Enter to add"
                />
                <button
                  type="button"
                  onClick={() =>
                    addToArray("chronicConditions", newCondition, () =>
                      setNewCondition(""),
                    )
                  }
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.chronicConditions || []).map((c: string, i: number) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 bg-yellow-50 text-yellow-700 text-xs px-2 py-1 rounded-full"
                  >
                    {c}
                    <button
                      onClick={() => removeFromArray("chronicConditions", i)}
                      className="hover:text-yellow-900"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className={labelClass}>Past Surgeries</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newSurgery}
                  onChange={(e) => setNewSurgery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addToArray("pastSurgeries", newSurgery, () =>
                        setNewSurgery(""),
                      );
                    }
                  }}
                  className={inputClass}
                  placeholder="e.g. Appendectomy 2019 — press Enter to add"
                />
                <button
                  type="button"
                  onClick={() =>
                    addToArray("pastSurgeries", newSurgery, () =>
                      setNewSurgery(""),
                    )
                  }
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.pastSurgeries || []).map((s: string, i: number) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
                  >
                    {s}
                    <button
                      onClick={() => removeFromArray("pastSurgeries", i)}
                      className="hover:text-gray-900"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Family History</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newFamily}
                  onChange={(e) => setNewFamily(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addToArray("familyHistory", newFamily, () =>
                        setNewFamily(""),
                      );
                    }
                  }}
                  className={inputClass}
                  placeholder="e.g. Father - Hypertension — press Enter to add"
                />
                <button
                  type="button"
                  onClick={() =>
                    addToArray("familyHistory", newFamily, () =>
                      setNewFamily(""),
                    )
                  }
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.familyHistory || []).map((f: string, i: number) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full"
                  >
                    {f}
                    <button
                      onClick={() => removeFromArray("familyHistory", i)}
                      className="hover:text-purple-900"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </section>
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  value={form.emergencyContact?.name || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      emergencyContact: {
                        ...form.emergencyContact,
                        name: e.target.value,
                      },
                    })
                  }
                  className={inputClass}
                  placeholder="e.g. Amaka Okafor"
                />
              </div>
              <div>
                <label className={labelClass}>Relationship</label>
                <input
                  type="text"
                  value={form.emergencyContact?.relationship || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      emergencyContact: {
                        ...form.emergencyContact,
                        relationship: e.target.value,
                      },
                    })
                  }
                  className={inputClass}
                  placeholder="e.g. Spouse"
                />
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  type="tel"
                  value={form.emergencyContact?.phone || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      emergencyContact: {
                        ...form.emergencyContact,
                        phone: e.target.value,
                      },
                    })
                  }
                  className={inputClass}
                  placeholder="+2348012345678"
                />
              </div>
            </div>
          </section>
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Insurance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Insurance Provider</label>
                <input
                  type="text"
                  value={form.insuranceProvider || ""}
                  onChange={(e) =>
                    setForm({ ...form, insuranceProvider: e.target.value })
                  }
                  className={inputClass}
                  placeholder="e.g. NHIS"
                />
              </div>
              <div>
                <label className={labelClass}>Insurance Number</label>
                <input
                  type="text"
                  value={form.insuranceNumber || ""}
                  onChange={(e) =>
                    setForm({ ...form, insuranceNumber: e.target.value })
                  }
                  className={inputClass}
                  placeholder="e.g. NHIS/123456"
                />
              </div>
            </div>
          </section>

          <button
            onClick={handleSave}
            disabled={
              !form.bloodGroup ||
              !form.genotype ||
              !form.dateOfBirth ||
              !form.gender ||
              !form.height ||
              !form.weight ||
              saving
            }
            className="w-full bg-blue-600 text-white py-2.5 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save Health Profile"}
          </button>
          <div className="mt-2">
            <DocumentsSection
              patientId={getUserIdFromToken()}
              canUpload={true}
            />
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
