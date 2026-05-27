/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getToken, saveToken } from "@/lib/auth/getSession";
import ConfirmModal from "@/components/ConfirmModal";

function getRoleFromToken(): string {
  const token = getToken();
  if (!token) return "";
  try {
    return JSON.parse(atob(token.split(".")[1])).role;
  } catch {
    return "";
  }
}

export default function SettingsPage() {
  const role = getRoleFromToken();

  const [profile, setProfile] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // clinic settings state
  const [selectedClinic, setSelectedClinic] = useState("");
  const [clinicSaving, setClinicSaving] = useState(false);
  const [clinicMessage, setClinicMessage] = useState("");
  const [clinicError, setClinicError] = useState("");
  const [showClinicModal, setShowClinicModal] = useState(false);

  // preferred doctor state (patients only though)
  const [preferredDoctor, setPreferredDoctor] = useState("");
  const [doctorSaving, setDoctorSaving] = useState(false);
  const [doctorMessage, setDoctorMessage] = useState("");
  const [doctorError, setDoctorError] = useState("");
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [pendingDoctorValue, setPendingDoctorValue] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, clinicsRes] = await Promise.all([
          fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch("/api/clinics/all", {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
        ]);

        const profileData = await profileRes.json();
        const clinicsData = await clinicsRes.json();

        setProfile(profileData.user);
        setClinics(clinicsData.clinics || []);

        if (profileData.user?.clinicId) {
          setSelectedClinic(
            // profileData.user.clinicId?._id?.toString() ||
            profileData.user.clinicId?.toString() || "",
          );

          // fetch doctors for this clinic if patient
          if (role === "patient") {
            const usersRes = await fetch("/api/users", {
              headers: { Authorization: `Bearer ${getToken()}` },
            });
            const usersData = await usersRes.json();
            setDoctors(usersData.doctors || []);

            if (profileData.user?.preferredDoctorId) {
              setPreferredDoctor(
                profileData.user.preferredDoctorId?._id?.toString() ||
                  profileData.user.preferredDoctorId?.toString() ||
                  "",
              );
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [role]);

  async function confirmClinicSave() {
    setShowClinicModal(false);
    setClinicSaving(true);
    setClinicMessage("");
    setClinicError("");

    try {
      const res = await fetch("/api/users/clinic", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ clinicId: selectedClinic }),
      });

      const data = await res.json();
      if (!res.ok) {
        setClinicError(data.error || "Failed to save");
        return;
      }

      if (data.token) {
        saveToken(data.token);
      }

      setClinicMessage("Clinic set successfully ✅");
      setProfile((p: any) => ({ ...p, clinicId: selectedClinic }));

      // fetch doctors for new clinic if patient
      if (role === "patient") {
        const usersRes = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const usersData = await usersRes.json();
        setDoctors(usersData.doctors || []);
      }
    } catch {
      setClinicError("Something went wrong");
    } finally {
      setClinicSaving(false);
    }
  }

  async function confirmDoctorSave() {
    setShowDoctorModal(false);
    setDoctorSaving(true);
    setDoctorMessage("");
    setDoctorError("");

    try {
      const res = await fetch("/api/users/preferred-doctor", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          preferredDoctorId: pendingDoctorValue || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDoctorError(data.error || "Failed to save");
        return;
      }

      setPreferredDoctor(pendingDoctorValue);
      setDoctorMessage(
        pendingDoctorValue
          ? "Preferred doctor updated ✅"
          : "Preferred doctor removed ✅",
      );
    } catch {
      setDoctorError("Something went wrong");
    } finally {
      setDoctorSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading settings...</p>;

  const doctorAlreadySet =
    profile?.clinicId && (role === "doctor" || role === "receptionist");

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <h2 className="text-xl font-bold text-gray-800">Settings</h2>

      {role !== "admin" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-700 mb-1">
            My Clinic
          </h3>

          {(role === "doctor" || role === "receptionist") &&
            !profile?.clinicId && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
                ⚠️ Once you set your clinic you cannot change it. Choose
                carefully.
              </p>
            )}

          {doctorAlreadySet ? (
            // doctor/receptionist — show current clinic, locked
            <div className="bg-gray-50 border border-gray-200 rounded px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Current clinic</p>
              <p className="font-medium text-gray-800">
                {clinics.find(
                  (c) => c._id === (profile.clinicId?._id || profile.clinicId),
                )?.name || "Your clinic"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Contact support to change your clinic assignment.
              </p>
            </div>
          ) : (
            <>
              {clinicMessage && (
                <p className="text-green-600 text-sm mb-3">{clinicMessage}</p>
              )}
              {clinicError && (
                <p className="text-red-500 text-sm mb-3">{clinicError}</p>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select clinic
                </label>
                <select
                  value={selectedClinic}
                  onChange={(e) => setSelectedClinic(e.target.value)}
                  className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option className="text-black" value="">
                    — Select a clinic —
                  </option>
                  {clinics.map((c) => (
                    <option className="text-black" key={c._id} value={c._id}>
                      {c.name} · {c.state}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowClinicModal(true)}
                disabled={clinicSaving || !selectedClinic}
                className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {clinicSaving ? "Saving..." : "Save Clinic"}
              </button>
            </>
          )}
        </div>
      )}

      {/* PREFERRED DOCTOR (PATIENTS ONLY) */}
      {role === "patient" && profile?.clinicId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-700 mb-4">
            Preferred Doctor
          </h3>

          {doctorMessage && (
            <p className="text-green-600 text-sm mb-3">{doctorMessage}</p>
          )}
          {doctorError && (
            <p className="text-red-500 text-sm mb-3">{doctorError}</p>
          )}

          {doctors.length === 0 ? (
            <p className="text-sm text-gray-400">
              No doctors available at your current clinic.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select a doctor
                </label>
                <select
                  value={preferredDoctor}
                  onChange={(e) => {
                    setPendingDoctorValue(e.target.value);
                  }}
                  className="text-black w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option className="text-black" value="">
                    — No preferred doctor —
                  </option>
                  {doctors.map((d) => (
                    <option className="text-black" key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowDoctorModal(true)}
                disabled={
                  doctorSaving || pendingDoctorValue === preferredDoctor
                }
                className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {doctorSaving ? "Saving..." : "Save Preferred Doctor"}
              </button>
            </>
          )}
        </div>
      )}

      {showClinicModal && (
        <ConfirmModal
          title="Set Your Clinic"
          message={
            role === "doctor" || role === "receptionist"
              ? "You cannot change your clinic after setting it. Are you sure you want to proceed?"
              : "Are you sure you want to set this as your clinic?"
          }
          confirmText="Yes, Set Clinic"
          onConfirm={confirmClinicSave}
          onCancel={() => setShowClinicModal(false)}
        />
      )}
      {/**  CONFIRM MODALS */}
      {showDoctorModal && (
        <ConfirmModal
          title={
            pendingDoctorValue
              ? "Update Preferred Doctor"
              : "Remove Preferred Doctor"
          }
          message={
            pendingDoctorValue
              ? "Are you sure you want to update your preferred doctor? This will pre-fill the doctor field when you book appointments."
              : "Are you sure you want to remove your preferred doctor?"
          }
          confirmText="Confirm"
          onConfirm={confirmDoctorSave}
          onCancel={() => setShowDoctorModal(false)}
        />
      )}
    </div>
  );
}
