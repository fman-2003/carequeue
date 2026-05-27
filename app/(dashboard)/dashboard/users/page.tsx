/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth/getSession";

export default function UsersPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
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

  if (loading) return <p className="text-gray-500">Loading users...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Clinic Users</h2>

      {/* modal for user detail */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">{selected.name}</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-700">Role:</span>{" "}
                {selected.role}
              </p>
              <p>
                <span className="font-medium text-gray-700">Email:</span>{" "}
                {selected.email}
              </p>
              <p>
                <span className="font-medium text-gray-700">Phone:</span>{" "}
                {selected.phone || "—"}
              </p>
              <p>
                <span className="font-medium text-gray-700">Joined:</span>{" "}
                {new Date(selected.createdAt).toDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-8">
        <h3 className="text-base font-semibold text-gray-700 mb-3">
          Doctors ({doctors.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {doctors.map((doctor) => (
            <button
              key={doctor._id}
              onClick={() => setSelected(doctor)}
              className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition"
            >
              <p className="font-medium text-gray-800">{doctor.name}</p>
              <p className="text-sm text-gray-500 mt-1">{doctor.email}</p>
              <p className="text-xs text-blue-500 mt-2">View details →</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-gray-700 mb-3">
          Patients ({patients.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <button
              key={patient._id}
              onClick={() => setSelected(patient)}
              className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition"
            >
              <p className="font-medium text-gray-800">{patient.name}</p>
              <p className="text-sm text-gray-500 mt-1">{patient.email}</p>
              <p className="text-xs text-blue-500 mt-2">View details →</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
