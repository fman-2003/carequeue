/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth/getSession";
import PageWrapper from "@/components/layout/PageWrapper";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";

export default function VisitRecordPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const router = useRouter();
  const { appointmentId } = use(params);

  const [appointment, setAppointment] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    chiefComplaint: "",
    diagnosis: "",
    clinicalNotes: "",
    treatmentPlan: "",
    vitals: {
      bloodPressure: "",
      temperature: "",
      pulseRate: "",
      respiratoryRate: "",
      oxygenSaturation: "",
      weight: "",
    },
    prescriptions: [] as any[],
    labTestsOrdered: [] as string[],
    followUpDate: "",
    referral: "",
  });

  const [newLab, setNewLab] = useState("");
  const [newRx, setNewRx] = useState({
    medication: "",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "",
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [apptRes, visitRes] = await Promise.all([
          fetch(`/api/appointments/${appointmentId}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch(`/api/ehr/visits/${appointmentId}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
        ]);

        const apptData = await apptRes.json();
        const visitData = await visitRes.json();

        if (apptData.appointment) {
          setAppointment(apptData.appointment);

          // fetch patient's medical profile for reference
          const profileRes = await fetch(
            `/api/ehr/profile?patientId=${apptData.appointment.patientId?._id}`,
            { headers: { Authorization: `Bearer ${getToken()}` } },
          );
          const profileData = await profileRes.json();
          setProfile(profileData.profile);
        }

        if (visitData.record) {
          setExisting(visitData.record);
          setForm({
            chiefComplaint: visitData.record.chiefComplaint || "",
            diagnosis: visitData.record.diagnosis || "",
            clinicalNotes: visitData.record.clinicalNotes || "",
            treatmentPlan: visitData.record.treatmentPlan || "",
            vitals: {
              bloodPressure:
                visitData.record.vitals?.bloodPressure?.toString() || "",
              temperature:
                visitData.record.vitals?.temperature?.toString() || "",
              pulseRate: visitData.record.vitals?.pulseRate?.toString() || "",
              respiratoryRate:
                visitData.record.vitals?.respiratoryRate?.toString() || "",
              oxygenSaturation:
                visitData.record.vitals?.oxygenSaturation?.toString() || "",
              weight: visitData.record.vitals?.weight?.toString() || "",
            },
            prescriptions: visitData.record.prescriptions || [],
            labTestsOrdered: visitData.record.labTestsOrdered || [],
            followUpDate: visitData.record.followUpDate
              ? new Date(visitData.record.followUpDate)
                  .toISOString()
                  .split("T")[0]
              : "",
            referral: visitData.record.referral || "",
          });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [appointmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        appointmentId, // already a string from useParams
        patientId:
          typeof appointment?.patientId === "object"
            ? appointment.patientId?._id?.toString()
            : appointment?.patientId?.toString(),
        ...form,
        vitals: {
          bloodPressure: form.vitals.bloodPressure || undefined,
          temperature: form.vitals.temperature
            ? Number(form.vitals.temperature)
            : undefined,
          pulseRate: form.vitals.pulseRate
            ? Number(form.vitals.pulseRate)
            : undefined,
          respiratoryRate: form.vitals.respiratoryRate
            ? Number(form.vitals.respiratoryRate)
            : undefined,
          oxygenSaturation: form.vitals.oxygenSaturation
            ? Number(form.vitals.oxygenSaturation)
            : undefined,
          weight: form.vitals.weight ? Number(form.vitals.weight) : undefined,
        },
        followUpDate: form.followUpDate
          ? new Date(form.followUpDate).toISOString()
          : undefined,
      };

      const url = existing
        ? `/api/ehr/visits/${appointmentId}`
        : "/api/ehr/visits";
      const method = existing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }

      setSuccess("Visit record saved ✅");
      setExisting(data.record);
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-neutral-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary-500";
  const labelClass = "block text-sm font-medium text-neutral-700 mb-1";
  const textareaClass = `${inputClass} resize-none`;

  if (loading) return (
    <PageWrapper>
      <h2 className="text-xl font-bold text-neutral-800">
        {existing ? "Edit Visit Record" : "New Visit Record"}
      </h2>
      <p className="text-neutral-500">Loading...</p>
    </PageWrapper>
  );

  return (
    <PageWrapper>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors"
          >
            <ArrowBackOutlinedIcon
              sx={{ fontSize: 20, color: "var(--color-text-secondary)" }}
            />
          </button>
          <div>
            <h2 className="text-xl font-bold text-neutral-800">
              {existing ? "Edit Visit Record" : "New Visit Record"}
            </h2>
            {appointment && (
              <p className="text-sm text-neutral-500 mt-0.5">
                {appointment.patientId?.name} ·{" "}
                {new Date(appointment.date).toDateString()} ·{" "}
                {appointment.timeSlot} ·{" "}
                {appointment.clinicId?.name || "Unknown Clinic"}
              </p>
            )}
          </div>
        </div>

        {/* patient profile summary for doc ref */}
        {profile && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">
              Patient Health Summary
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs text-primary-800">
              <p>
                <span className="font-medium">Blood Group:</span>{" "}
                {profile.bloodGroup || "—"}
              </p>
              <p>
                <span className="font-medium">Genotype:</span>{" "}
                {profile.genotype || "—"}
              </p>
              <p>
                <span className="font-medium">Weight:</span>{" "}
                {profile.weight ? `${profile.weight}kg` : "—"}
              </p>
            </div>
            {profile.allergies?.length > 0 && (
              <p className="text-xs text-red-700 mt-2">
                ⚠️ <span className="font-medium">Allergies:</span>{" "}
                {profile.allergies.join(", ")}
              </p>
            )}
            {profile.chronicConditions?.length > 0 && (
              <p className="text-xs text-orange-700 mt-1">
                🏥 <span className="font-medium">Conditions:</span>{" "}
                {profile.chronicConditions.join(", ")}
              </p>
            )}
          </div>
        )}

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

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <section className="bg-white border border-neutral-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">
              Vitals
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: "Blood Pressure (mmHg)",
                  key: "bloodPressure",
                  placeholder: "120/80",
                  type: "text",
                },
                {
                  label: "Temperature (°C)",
                  key: "temperature",
                  placeholder: "37.0",
                  type: "number",
                },
                {
                  label: "Pulse Rate (bpm)",
                  key: "pulseRate",
                  placeholder: "72",
                  type: "number",
                },
                {
                  label: "Respiratory Rate",
                  key: "respiratoryRate",
                  placeholder: "16",
                  type: "number",
                },
                {
                  label: "O₂ Saturation (%)",
                  key: "oxygenSaturation",
                  placeholder: "98",
                  type: "number",
                },
                {
                  label: "Weight (kg)",
                  key: "weight",
                  placeholder: "70",
                  type: "number",
                },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input
                    type={type}
                    value={(form.vitals as any)[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        vitals: { ...form.vitals, [key]: e.target.value },
                      })
                    }
                    className={inputClass}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </section>
          <section className="bg-white border border-neutral-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">
              Clinical Notes
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>
                  Chief Complaint{" "}
                  <span className="text-red-500 text-sm">*</span>
                </label>
                <textarea
                  value={form.chiefComplaint}
                  onChange={(e) =>
                    setForm({ ...form, chiefComplaint: e.target.value })
                  }
                  className={textareaClass}
                  rows={2}
                  placeholder="Patient's primary reason for visit in their own words"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>
                  Diagnosis <span className="text-red-500 text-sm">*</span>
                </label>
                <textarea
                  value={form.diagnosis}
                  onChange={(e) =>
                    setForm({ ...form, diagnosis: e.target.value })
                  }
                  className={textareaClass}
                  rows={2}
                  placeholder="Doctor's diagnosis"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>
                  Clinical Notes <span className="text-red-500 text-sm">*</span>
                </label>
                <textarea
                  value={form.clinicalNotes}
                  onChange={(e) =>
                    setForm({ ...form, clinicalNotes: e.target.value })
                  }
                  className={textareaClass}
                  rows={4}
                  placeholder="Detailed clinical observations and findings"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>
                  Treatment Plan <span className="text-red-500 text-sm">*</span>
                </label>
                <textarea
                  value={form.treatmentPlan}
                  onChange={(e) =>
                    setForm({ ...form, treatmentPlan: e.target.value })
                  }
                  className={textareaClass}
                  rows={3}
                  placeholder="Recommended treatment and next steps"
                  required
                />
              </div>
            </div>
          </section>
          <section className="bg-white border border-neutral-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">
              Prescriptions
            </h3>
            {form.prescriptions.map((rx: any, i: number) => (
              <div
                key={i}
                className="flex items-start justify-between bg-neutral-50 rounded p-3 mb-2"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-800">
                    {rx.medication}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {rx.dosage} · {rx.frequency} · {rx.duration}
                  </p>
                  {rx.instructions && (
                    <p className="text-xs text-neutral-400">
                      {rx.instructions}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      prescriptions: form.prescriptions.filter(
                        (_, idx) => idx !== i,
                      ),
                    })
                  }
                  className="text-red-400 hover:text-red-600 text-sm ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="border border-dashed border-neutral-300 rounded p-4 mt-2">
              <p className="text-xs text-neutral-500 mb-3 font-medium">
                Add Prescription
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Medication",
                    key: "medication",
                    placeholder: "e.g. Amoxicillin",
                  },
                  { label: "Dosage", key: "dosage", placeholder: "e.g. 500mg" },
                  {
                    label: "Frequency",
                    key: "frequency",
                    placeholder: "e.g. Twice daily",
                  },
                  {
                    label: "Duration",
                    key: "duration",
                    placeholder: "e.g. 7 days",
                  },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-neutral-600 mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={(newRx as any)[key]}
                      onChange={(e) =>
                        setNewRx({ ...newRx, [key]: e.target.value })
                      }
                      className={inputClass}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs text-neutral-600 mb-1">
                    Instructions (optional)
                  </label>
                  <input
                    type="text"
                    value={newRx.instructions}
                    onChange={(e) =>
                      setNewRx({ ...newRx, instructions: e.target.value })
                    }
                    className={inputClass}
                    placeholder="e.g. Take after meals"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    !newRx.medication ||
                    !newRx.dosage ||
                    !newRx.frequency ||
                    !newRx.duration
                  )
                    return;
                  setForm({
                    ...form,
                    prescriptions: [...form.prescriptions, { ...newRx }],
                  });
                  setNewRx({
                    medication: "",
                    dosage: "",
                    frequency: "",
                    duration: "",
                    instructions: "",
                  });
                }}
                className="mt-3 text-sm bg-primary-600 text-white px-4 py-1.5 rounded hover:bg-primary-700 transition"
              >
                + Add Prescription
              </button>
            </div>
          </section>
          <section className="bg-white border border-neutral-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">
              Lab Tests Ordered
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newLab}
                onChange={(e) => setNewLab(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newLab.trim()) return;
                    setForm({
                      ...form,
                      labTestsOrdered: [...form.labTestsOrdered, newLab.trim()],
                    });
                    setNewLab("");
                  }
                }}
                className={inputClass}
                placeholder="e.g. Full Blood Count — press Enter to add"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newLab.trim()) return;
                  setForm({
                    ...form,
                    labTestsOrdered: [...form.labTestsOrdered, newLab.trim()],
                  });
                  setNewLab("");
                }}
                className="px-3 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.labTestsOrdered.map((lab: string, i: number) => (
                <span
                  key={i}
                  className="flex items-center gap-1 bg-primary-50 text-primary-700 text-xs px-2 py-1 rounded-full"
                >
                  {lab}
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        labTestsOrdered: form.labTestsOrdered.filter(
                          (_, idx) => idx !== i,
                        ),
                      })
                    }
                    className="hover:text-primary-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">
              Follow Up & Referral
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Follow-Up Date</label>
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) =>
                    setForm({ ...form, followUpDate: e.target.value })
                  }
                  className={inputClass}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div>
                <label className={labelClass}>Referral</label>
                <input
                  type="text"
                  value={form.referral}
                  onChange={(e) =>
                    setForm({ ...form, referral: e.target.value })
                  }
                  className={inputClass}
                  placeholder="e.g. Referred to Cardiologist"
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={
              saving ||
              !form.chiefComplaint ||
              !form.diagnosis ||
              !form.clinicalNotes ||
              !form.treatmentPlan
            }
            className="w-full bg-primary-600 text-white py-2.5 rounded font-medium hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {saving
              ? "Saving..."
              : existing
                ? "Update Visit Record"
                : "Save Visit Record"}
          </button>
        </form>
      </div>
    </PageWrapper>
  );
}
