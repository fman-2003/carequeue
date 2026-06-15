/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth/getSession";
import ClinicGuard from "@/components/ClinicGuard";
import ConfirmModal from "@/components/ConfirmModal";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import PageTour from "@/components/ui/PageTour";
import { TOURS } from "@/lib/tour";
import PageWrapper from "@/components/layout/PageWrapper";

const ITEMS_PER_PAGE = 15;

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
            {[
              { label: "Patient", value: appointment.patientId?.name },
              { label: "Doctor", value: appointment.doctorId?.name },
              {
                label: "Date",
                value: new Date(appointment.date).toDateString(),
              },
              { label: "Time Slot", value: appointment.timeSlot },
              { label: "Status", value: appointment.status },
              {
                label: "Risk",
                value:
                  appointment.noShowRisk != null
                    ? `${Math.round(appointment.noShowRisk * 100)}%`
                    : "—",
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  {label}
                </p>
                <p className="font-medium text-gray-800 mt-0.5">
                  {value || "—"}
                </p>
              </div>
            ))}
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

  // filter, sort, search state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // pagination
  const [currentPage, setCurrentPage] = useState(1);

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

  const filtered = useMemo(() => {
    let result = [...appointments];

    // search by patient name, doctor name or timeslot
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.patientId?.name?.toLowerCase().includes(q) ||
          a.doctorId?.name?.toLowerCase().includes(q) ||
          a.timeSlot?.toLowerCase().includes(q),
      );
    }

    // status filter
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    // sort by date
    result.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === "asc" ? diff : -diff;
    });

    return result;
  }, [appointments, search, statusFilter, sortOrder]);

  // reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortOrder]);

  // paginate
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

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

    if (appt.status === "cancelled") {
      return <span className="text-xs text-gray-400">Cancelled</span>;
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

    return (
      <div className="flex flex-col gap-1">
        {appt.status === "pending" && (
          <>
            <button
              disabled={statusLoading}
              onClick={(e) => {
                e.stopPropagation();
                setPendingChange({ id: appt._id, status: "confirmed" });
              }}
              className="text-xs px-2 py-1 border border-green-200 text-green-600 rounded hover:bg-green-50 transition"
            >
              Confirm
            </button>
            <button
              disabled={statusLoading}
              onClick={(e) => {
                e.stopPropagation();
                setPendingChange({ id: appt._id, status: "cancelled" });
              }}
              className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50 transition"
            >
              Cancel
            </button>
          </>
        )}
        {appt.status === "confirmed" && (
          <>
            <button
              disabled={statusLoading}
              onClick={(e) => {
                e.stopPropagation();
                setPendingChange({ id: appt._id, status: "completed" });
              }}
              className="text-xs px-2 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition"
            >
              Complete
            </button>
            <button
              disabled={statusLoading}
              onClick={(e) => {
                e.stopPropagation();
                setPendingChange({ id: appt._id, status: "no-show" });
              }}
              className="text-xs px-2 py-1 border border-orange-200 text-orange-500 rounded hover:bg-orange-50 transition"
            >
              No Show
            </button>
            <button
              disabled={statusLoading}
              onClick={(e) => {
                e.stopPropagation();
                setPendingChange({ id: appt._id, status: "cancelled" });
              }}
              className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50 transition"
            >
              Cancel
            </button>
          </>
        )}
        {appt.status === "completed" && (
          <Link
            href={`/dashboard/visit/${appt._id}`}
            onClick={(e) => e.stopPropagation()}
            className={`text-xs px-2 py-1 border rounded transition text-center ${
              appt.hasVisitRecord
                ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                : "border-blue-300 text-blue-600 hover:bg-blue-50"
            }`}
          >
            {appt.hasVisitRecord ? "View Notes" : "Add Notes"}
          </Link>
        )}
      </div>
    );
  }

  if (loading)
    return (
      <PageWrapper>
        
        <p className="text-gray-500">Loading appointments...</p>
      </PageWrapper>
    );
  if (error && appointments.length !== 0)
    return (
      <PageWrapper>
        
        <p className="text-red-500">{error}</p>
      </PageWrapper>
    );

  const tourSteps =
    role === "admin"
      ? TOURS.admin.appointments
      : role === "doctor"
        ? TOURS.doctor.appointments
        : role === "patient"
          ? TOURS.patient.appointments
          : [];

  const content = (
    <PageWrapper>
      {tourSteps.length > 0 && (
        <PageTour tourId={`${role}-appointments`} steps={tourSteps} />
      )}
      <div className="flex items-center justify-between mb-6">
        
        {(role === "doctor" || role === "receptionist") && (
          <Link
            href="/dashboard/appointments/new"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            + Book New
          </Link>
        )}
      </div>

      {/* ── FILTERS ROW ─────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Search */}
        <div className="flex-1 min-w-50">
          <SearchInput
            placeholder="Search by patient or doctor name..."
            onSearch={setSearch}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No Show</option>
        </select>

        {/* Sort order */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          className="border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="asc">Date: Earliest First</option>
          <option value="desc">Date: Latest First</option>
        </select>
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-400 mb-3">
        {filtered.length} appointment{filtered.length !== 1 ? "s" : ""} found
        {search || statusFilter !== "all" ? " (filtered)" : ""}
      </p>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">
            No appointments match your search.
          </p>
        </div>
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
              {paginated.map((appt) => (
                <tr
                  key={appt._id}
                  onClick={() => setSelectedAppt(appt)}
                  className="odd:bg-neutral-50 even:bg-neutral-100 border-b border-neutral-300 cursor-pointer"
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    {role === "doctor" && <DoctorActions appt={appt} />}
                    {role === "patient" &&
                      appt.status !== "cancelled" &&
                      appt.status !== "completed" && (
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

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

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
    </PageWrapper>
  );

  // patients don't need clinic guard on appointments
  if (role === "patient") return content;

  return (
    <PageWrapper>
      <ClinicGuard hasClinic={!!clinicId} role={role}>
        {content}
      </ClinicGuard>
    </PageWrapper>
  );
}
