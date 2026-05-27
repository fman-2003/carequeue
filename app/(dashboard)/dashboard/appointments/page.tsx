/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth/getSession";
import ClinicGuard from "@/components/ClinicGuard";
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

function getClinicIdFromToken(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).clinicId || null;
  } catch {
    return null;
  }
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  completed: "bg-blue-100 text-blue-700",
  "no-show": "bg-red-100 text-red-600",
};

// status change warning messages that
// inform doctor that particular changes affect the waitlist

const STATUS_WARNINGS: Record<string, string> = {
  cancelled:
    "Careful! Cancelling this appointment will notify the next patient on the waitlist that this slot is now available.",
  completed:
    "Mark this appointment as completed.  This action cannot be undone.",
  "no-show":
    "Mark this patient as a no-show. They will be notified via WhatsApp.",
  confirmed:
    "Confirm this appointment. The patient will be notified via WhatsApp.",
  pending: "Set this appointment back to pending status.",
};

function AppointmentDetailModal({
  appointment,
  onClose,
}: {
  appointment: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Appointment Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Patient
              </p>
              <p className="font-medium text-gray-800 mt-0.5">
                {appointment.patientId?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Doctor
              </p>
              <p className="font-medium text-gray-800 mt-0.5">
                {appointment.doctorId?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Date
              </p>
              <p className="font-medium text-gray-800 mt-0.5">
                {new Date(appointment.date).toDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Time Slot
              </p>
              <p className="font-medium text-gray-800 mt-0.5">
                {appointment.timeSlot}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Status
              </p>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${STATUS_STYLES[appointment.status] || ""}`}
              >
                {appointment.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                No-Show Risk
              </p>
              <p className="font-medium text-gray-800 mt-0.5">
                {appointment.noShowRisk != null
                  ? `${Math.round(appointment.noShowRisk * 100)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {appointment.reason && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Reason
              </p>
              <p className="text-gray-700 mt-0.5 bg-gray-50 rounded p-3">
                {appointment.reason}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Booked On
            </p>
            <p className="text-gray-600 mt-0.5">
              {new Date(appointment.createdAt).toDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const role = getRoleFromToken();
  const clinicId = getClinicIdFromToken();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState("");
  // detail modal
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  // confirm modal for status change
  const [pendingChange, setPendingChange] = useState<{
    id: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/appointments", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setAppointments(data.appointments || []);
      })
      .catch(() => setError("Something went wrong"))
      .finally(() => setLoading(false));
  }, []);

  async function executeStatusChange(id: string, status: string) {
    setPendingChange(null);
    setStatusLoading(true);

    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Update failed");
        return;
      }

      setAppointments((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status } : a)),
      );
    } catch {
      alert("Something went wrong");
    } finally {
      setStatusLoading(false);
    }
  }

  // DOCTOR ACTION BUTTONS
  function DoctorActions({ appt }: { appt: any }) {
    if (
      appt.status !== "pending" &&
      appt.status !== "confirmed" &&
      appt.status !== "completed"
    ) {
      return <span className="text-xs text-gray-400">No actions</span>;
    }

    const actions: { label: string; status: string; color: string }[] = [];

    if (appt.status === "pending") {
      actions.push({
        label: "Confirm",
        status: "confirmed",
        color: "text-green-600 border-green-200 hover:bg-green-50",
      });
      actions.push({
        label: "Cancel",
        status: "cancelled",
        color: "text-red-500 border-red-200 hover:bg-red-50",
      });
    }
    if (appt.status === "confirmed") {
      actions.push({
        label: "Complete",
        status: "completed",
        color: "text-blue-600 border-blue-200 hover:bg-blue-50",
      });
      actions.push({
        label: "No Show",
        status: "no-show",
        color: "text-orange-500 border-orange-200 hover:bg-orange-50",
      });
      actions.push({
        label: "Cancel",
        status: "cancelled",
        color: "text-red-500 border-red-200 hover:bg-red-50",
      });
    }
    let content;

    if (appt.status === "completed") {
      content = (
        <Link
          href={`/dashboard/visit/${appt._id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 transition"
        >
          {appt.hasVisitRecord ? "View Notes" : "Add Notes"}
        </Link>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        {content ? (
          <>{content}</>
        ) : (
          actions.map((action) => (
            <button
              disabled={statusLoading}
              key={action.status}
              onClick={(e) => {
                e.stopPropagation(); // prevent row click opening detail modal
                setPendingChange({ id: appt._id, status: action.status });
              }}
              className={`text-xs px-2 py-1 border rounded font-medium transition ${action.color}`}
            >
              {action.label}
            </button>
          ))
        )}
      </div>
    );
  }

  if (loading) return <p className="text-gray-500">Loading appointments...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const content = (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Appointments</h2>
        {(role === "doctor" || role === "receptionist") && (
          <Link
            href="/dashboard/appointments/new"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            + Book New
          </Link>
        )}
      </div>

      {appointments.length === 0 ? (
        <p className="text-gray-400">No appointments found.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Patient",
                  "Doctor",
                  "Date",
                  "Time Slot",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-gray-600 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr
                  key={appt._id}
                  onClick={() => setSelectedAppt(appt)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-800">
                    {appt.patientId?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {appt.doctorId?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(appt.date).toDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{appt.timeSlot}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[appt.status] || ""}`}
                    >
                      {appt.status}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()} // prevents detail modal opening when clicking actions
                  >
                    {role === "doctor" && <DoctorActions appt={appt} />}

                    {role === "patient" &&
                      appt.status !== "completed" &&
                      appt.status !== "cancelled" &&
                      appt.status !== "no-show" && (
                        <button
                          disabled={statusLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingChange({
                              id: appt._id,
                              status: "cancelled",
                            });
                          }}
                          className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Cancel
                        </button>
                      )}

                    {role === "admin" && (
                      <span className="text-xs text-gray-400">Read only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* appointment detail modal */}
      {selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
        />
      )}

      {/* status change modal */}
      {pendingChange && (
        <ConfirmModal
          title="Confirm Status Change"
          message={STATUS_WARNINGS[pendingChange.status] || "Are you sure?"}
          confirmText="Yes, Proceed"
          cancelText="Cancel"
          danger={pendingChange.status === "cancelled"}
          onConfirm={() =>
            executeStatusChange(pendingChange.id, pendingChange.status)
          }
          onCancel={() => setPendingChange(null)}
        />
      )}
    </div>
  );

  // patients don't need clinic guard on appointments
  if (role === "patient") return content;

  return (
    <ClinicGuard hasClinic={!!clinicId} role={role}>
      {content}
    </ClinicGuard>
  );
}
