/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { getClinicId } from "@/lib/auth/getSession";
import ClinicGuard from "@/components/ClinicGuard";
import SearchInput from "@/components/ui/SearchInput";
import PageTour from "@/components/ui/PageTour";
import { TOURS } from "@/lib/tour";
import PageWrapper from "@/components/layout/PageWrapper";

export default function UsersPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [userType, setUserType] = useState<"doctor" | "patient" | null>(null);

  // search states are separated from doctors and patients
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  // doctor detail stats
  const [doctorStats, setDoctorStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Reads the cached session hint that the dashboard layout refreshes
// from the server. UI convenience only: every API route re-derives
// role, clinic, and identity from the signed session cookie.
function getClinicIdFromToken(): string | null {
  return getClinicId();
}

  const clinicId = getClinicIdFromToken();

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setDoctors(data.doctors || []);
        setPatients(data.patients || []);
      })
      .catch(() => setError("Something went wrong"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelectDoctor(doctor: any) {
    setSelected(doctor);
    setUserType("doctor");
    setDoctorStats(null);
    setStatsLoading(true);

    /**
     * Fetch this doctor's appointments to compute
     * their operational overview — total appointments,
     * completion rate, no-show rate etc.
     * Admin uses this to understand each doctor's influence.
     */
    try {
      const res = await fetch(
        "/api/admin/doctor-stats?doctorId=" + doctor._id,
        {
        },
      );
      const data = await res.json();
      setDoctorStats(data.stats || null);
    } catch {
      // stats unavailable — show empty state
    } finally {
      setStatsLoading(false);
    }
  }

  function handleSelectPatient(patient: any) {
    setSelected(patient);
    setUserType("patient");
  }

  // filtered lists
  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctors;
    const q = doctorSearch.toLowerCase();
    return doctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) || d.email?.toLowerCase().includes(q),
    );
  }, [doctors, doctorSearch]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q),
    );
  }, [patients, patientSearch]);

  if (loading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading users...</p>
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
      <PageTour tourId="admin-users" steps={TOURS.admin.users} />
      <ClinicGuard hasClinic={!!clinicId} role="admin">
        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-strong p-4 sm:p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="font-bold text-gray-800">{selected.name}</h3>
                  <p className="text-xs text-gray-500 capitalize mt-0.5">
                    {userType}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelected(null);
                    setUserType(null);
                    setDoctorStats(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="px-6 py-4 flex flex-col gap-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: "Email", value: selected.email },
                    { label: "Phone", value: selected.phone || "—" },
                    {
                      label: "Joined",
                      value: new Date(selected.createdAt).toDateString(),
                    },
                    { label: "Role", value: selected.role },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded p-3">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="font-medium text-gray-800 mt-0.5 capitalize">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Doctor operational overview */}
                {userType === "doctor" && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                      Operational Overview
                    </p>
                    {statsLoading ? (
                      <p className="text-gray-400 text-sm">Loading stats...</p>
                    ) : doctorStats ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                          {
                            label: "Total Appointments",
                            value: doctorStats.total,
                          },
                          { label: "Completed", value: doctorStats.completed },
                          { label: "Pending", value: doctorStats.pending },
                          { label: "Cancelled", value: doctorStats.cancelled },
                          { label: "No Shows", value: doctorStats.noShow },
                          {
                            label: "Completion Rate",
                            value: `${doctorStats.completionRate}%`,
                          },
                          {
                            label: "No-Show Rate",
                            value: `${doctorStats.noShowRate}%`,
                          },
                          {
                            label: "Waitlist Patients",
                            value: doctorStats.waitlistCount,
                          },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded p-3">
                            <p className="text-xs text-gray-400">{label}</p>
                            <p className="font-bold text-gray-800 mt-0.5">
                              {value ?? "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        No appointment data yet.
                      </p>
                    )}
                  </div>
                )}

                {/* Patient full info */}
                {userType === "patient" && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                      Patient Details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-xs text-gray-400">
                          Preferred Doctor
                        </p>
                        <p className="font-medium text-gray-800 mt-0.5">
                          {selected.preferredDoctorId
                            ? doctors.find(
                                (d) => d._id === selected.preferredDoctorId,
                              )?.name || "Set"
                            : "Not set"}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-xs text-gray-400">Clinic Set</p>
                        <p className="font-medium text-gray-800 mt-0.5">
                          {selected.clinicId ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── DOCS SECTION ──────────────────────── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-700">
              Doctors ({filteredDoctors.length})
            </h3>
            <div className="w-64">
              <SearchInput
                placeholder="Search doctors..."
                onSearch={setDoctorSearch}
              />
            </div>
          </div>

          {filteredDoctors.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No doctors match your search.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredDoctors.map((doctor) => (
                <button
                  key={doctor._id}
                  onClick={() => handleSelectDoctor(doctor)}
                  className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-medium transition"
                >
                  <p className="font-medium text-gray-800">{doctor.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{doctor.email}</p>
                  <p className="text-xs text-blue-500 mt-2">View overview →</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* patients section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-700">
              Patients ({filteredPatients.length})
            </h3>
            <div className="w-64">
              <SearchInput
                placeholder="Search patients..."
                onSearch={setPatientSearch}
              />
            </div>
          </div>

          {filteredPatients.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No patients match your search.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredPatients.map((patient) => (
                <button
                  key={patient._id}
                  onClick={() => handleSelectPatient(patient)}
                  className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-medium transition"
                >
                  <p className="font-medium text-gray-800">{patient.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{patient.email}</p>
                  {patient.phone && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {patient.phone}
                    </p>
                  )}
                  <p className="text-xs text-blue-500 mt-2">View details →</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </ClinicGuard>
    </PageWrapper>
  );
}
