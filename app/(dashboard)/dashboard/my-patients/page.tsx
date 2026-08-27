/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { getRole, getClinicId } from "@/lib/auth/getSession";
import ClinicGuard from "@/components/ClinicGuard";
import SearchInput from "@/components/ui/SearchInput";
import DocumentsSection from "@/components/ehr/DocumentsSection";
import PageTour from "@/components/ui/PageTour";
import { TOURS } from "@/lib/tour";
import PageWrapper from "@/components/layout/PageWrapper";

// Reads the cached session hint that the dashboard layout refreshes
// from the server. UI convenience only: every API route re-derives
// role, clinic, and identity from the signed session cookie.
function getRoleFromToken(): string {
  return getRole();
}

function getClinicIdFromToken(): string | null {
  return getClinicId();
}

export default function MyPatientsPage() {
  const clinicId = getClinicIdFromToken();
  const role = getRoleFromToken();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [visitRecords, setVisitRecords] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "profile" | "visits" | "documents"
  >("profile");

  // search state
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/doctors/my-patients")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setPatients(data.patients || []);
      })
      .catch(() => setError("Something went wrong"))
      .finally(() => setLoading(false));
  }, []);

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q),
    );
  }, [patients, search]);

  async function handleSelectPatient(patient: any) {
    setSelected(patient);
    setProfile(null);
    setVisitRecords([]);
    setActiveTab("profile");
    setDetailLoading(true);

    try {
      const [profileRes, visitsRes] = await Promise.all([
        fetch(`/api/ehr/patients/${patient._id}/profile`),
        fetch(`/api/ehr/patients/${patient._id}/visits`),
      ]);

      const profileData = await profileRes.json();
      const visitsData = await visitsRes.json();

      setProfile(profileData.profile || null);
      setVisitRecords(visitsData.records || []);
    } catch {
      // silently fail — empty state shown
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setSelected(null);
    setProfile(null);
    setVisitRecords([]);
  }

  if (loading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading patients...</p>
      </PageWrapper>
    );
  if (error)
    return (
      <PageWrapper>
        <p className="text-red-500">{error}</p>
      </PageWrapper>
    );
  return (
    <PageWrapper>
      <PageTour
        tourId="doctor-my-patients"
        steps={TOURS.doctor["my-patients"]}
      />
      <ClinicGuard hasClinic={!!clinicId} role={role}>
        <div className="flex items-center shadow-medium justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500 mt-0.5">
              {filteredPatients.length} patient
              {filteredPatients.length !== 1 ? "s" : ""}
              {search ? " found" : " total"}
            </p>
          </div>
          <div className="w-64">
            <SearchInput
              placeholder="Search by name, email or phone..."
              onSearch={setSearch}
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Patients who have selected you as their preferred doctor. Click a
          patient to view their medical profile and visit history.
        </p>
        {/* ── PATIENT DETAIL MODAL ───────── */}
        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-strong p-4 sm:p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="font-bold text-gray-800">{selected.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selected.email}
                    {selected.phone && ` · ${selected.phone}`}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 px-6">
                {(["profile", "visits", "documents"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition capitalize ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab === "profile"
                      ? "Medical Profile"
                      : tab === "visits"
                        ? "Visit History"
                        : "Documents"}
                  </button>
                ))}
              </div>

              {/* Modal content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {detailLoading ? (
                  <p className="text-gray-500 text-sm">
                    Loading patient data...
                  </p>
                ) : (
                  <>
                    {/* ── MEDICAL PROFILE TAB ────────── */}
                    {activeTab === "profile" && (
                      <div className="flex flex-col gap-4 text-sm">
                        {!profile ? (
                          <p className="text-gray-400">
                            This patient has not filled in their health profile
                            yet.
                          </p>
                        ) : (
                          <>
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                                Biometrics
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                  {
                                    label: "Blood Group",
                                    value: profile.bloodGroup,
                                  },
                                  {
                                    label: "Genotype",
                                    value: profile.genotype,
                                  },
                                  { label: "Gender", value: profile.gender },
                                  {
                                    label: "Height",
                                    value: profile.height
                                      ? `${profile.height} cm`
                                      : null,
                                  },
                                  {
                                    label: "Weight",
                                    value: profile.weight
                                      ? `${profile.weight} kg`
                                      : null,
                                  },
                                  {
                                    label: "Date of Birth",
                                    value: profile.dateOfBirth
                                      ? new Date(
                                          profile.dateOfBirth,
                                        ).toDateString()
                                      : null,
                                  },
                                ].map(({ label, value }) => (
                                  <div
                                    key={label}
                                    className="bg-gray-50 rounded p-2"
                                  >
                                    <p className="text-xs text-gray-400">
                                      {label}
                                    </p>
                                    <p className="font-medium text-gray-800 mt-0.5">
                                      {value || "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {profile.allergies?.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  ⚠️ Allergies
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {profile.allergies.map(
                                    (a: string, i: number) => (
                                      <span
                                        key={i}
                                        className="bg-red-50 text-red-700 text-xs px-2 py-1 rounded-full"
                                      >
                                        {a}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                            {profile.chronicConditions?.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  Chronic Conditions
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {profile.chronicConditions.map(
                                    (c: string, i: number) => (
                                      <span
                                        key={i}
                                        className="bg-orange-50 text-orange-700 text-xs px-2 py-1 rounded-full"
                                      >
                                        {c}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                            {profile.currentMedications?.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  Current Medications
                                </p>
                                <div className="flex flex-col gap-2">
                                  {profile.currentMedications.map(
                                    (m: any, i: number) => (
                                      <div
                                        key={i}
                                        className="bg-blue-50 rounded p-2"
                                      >
                                        <p className="font-medium text-blue-800">
                                          {m.name}
                                        </p>
                                        <p className="text-xs text-blue-600">
                                          {m.dosage} · {m.frequency}
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                            {profile.familyHistory?.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  Family History
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {profile.familyHistory.map(
                                    (f: string, i: number) => (
                                      <span
                                        key={i}
                                        className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full"
                                      >
                                        {f}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                            {profile.emergencyContact?.name && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  Emergency Contact
                                </p>
                                <div className="bg-gray-50 rounded p-3">
                                  <p className="font-medium text-gray-800">
                                    {profile.emergencyContact.name}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {profile.emergencyContact.relationship} ·{" "}
                                    {profile.emergencyContact.phone}
                                  </p>
                                </div>
                              </div>
                            )}

                            {profile.insuranceProvider && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                                  Insurance
                                </p>
                                <p className="text-gray-700">
                                  {profile.insuranceProvider}
                                  {profile.insuranceNumber &&
                                    ` · ${profile.insuranceNumber}`}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* ── VISIT HISTORY TAB ──────────── */}
                    {activeTab === "visits" && (
                      <div>
                        {visitRecords.length === 0 ? (
                          <p className="text-gray-400 text-sm">
                            No visit records for this patient yet.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {visitRecords.map((record) => (
                              <div
                                key={record._id}
                                className="border border-gray-200 rounded-lg p-4"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-gray-800">
                                    {new Date(
                                      record.appointmentId?.date ||
                                        record.createdAt,
                                    ).toDateString()}
                                    {record.appointmentId?.timeSlot &&
                                      ` · ${record.appointmentId.timeSlot}`}
                                  </p>
                                </div>

                                <div className="flex flex-col gap-2 text-sm">
                                  <div>
                                    <p className="text-xs text-gray-400">
                                      Chief Complaint
                                    </p>
                                    <p className="text-gray-700">
                                      {record.chiefComplaint}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">
                                      Diagnosis
                                    </p>
                                    <p className="text-gray-700">
                                      {record.diagnosis}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">
                                      Clinical Notes
                                    </p>
                                    <p className="text-gray-700">
                                      {record.clinicalNotes}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">
                                      Treatment Plan
                                    </p>
                                    <p className="text-gray-700">
                                      {record.treatmentPlan}
                                    </p>
                                  </div>

                                  {record.prescriptions?.length > 0 && (
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        Prescriptions
                                      </p>
                                      {record.prescriptions.map(
                                        (rx: any, i: number) => (
                                          <div
                                            key={i}
                                            className="bg-blue-50 rounded p-2 mb-1"
                                          >
                                            <p className="font-medium text-blue-800 text-xs">
                                              {rx.medication} — {rx.dosage} ·{" "}
                                              {rx.frequency} · {rx.duration}
                                            </p>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}

                                  {record.labTestsOrdered?.length > 0 && (
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        Lab Tests
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {record.labTestsOrdered.map(
                                          (lab: string, i: number) => (
                                            <span
                                              key={i}
                                              className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full"
                                            >
                                              {lab}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {record.followUpDate && (
                                    <p className="text-xs text-gray-600">
                                      <span className="font-medium">
                                        Follow-up:
                                      </span>{" "}
                                      {new Date(
                                        record.followUpDate,
                                      ).toDateString()}
                                    </p>
                                  )}

                                  {record.referral && (
                                    <p className="text-xs text-gray-600">
                                      <span className="font-medium">
                                        Referral:
                                      </span>{" "}
                                      {record.referral}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {activeTab === "documents" && selected && (
                      <DocumentsSection
                        patientId={selected._id}
                        canUpload={true}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {filteredPatients.length === 0 ? (
          <p className="text-gray-400">No patients match your search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredPatients.map((patient) => (
              <button
                key={patient._id}
                onClick={() => handleSelectPatient(patient)}
                className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition"
              >
                <p className="font-medium text-gray-800">{patient.name}</p>
                <p className="text-sm text-gray-500 mt-1">{patient.email}</p>
                {patient.phone && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {patient.phone}
                  </p>
                )}
                <p className="text-xs text-blue-500 mt-2">
                  View profile & history →
                </p>
              </button>
            ))}
          </div>
        )}
      </ClinicGuard>
    </PageWrapper>
  );
}
