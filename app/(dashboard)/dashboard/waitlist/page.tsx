/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { getToken } from "@/lib/auth/getSession";
import ConfirmModal from "@/components/ConfirmModal";

// COUNTDOWN COMPONENT
function Countdown({
  expiresAt,
  waitlistId,
  onExpired,
}: {
  expiresAt: string;
  waitlistId: string;
  onExpired: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState("");
  const hasExpired = useRef(false);

  useEffect(() => {
    async function handleExpiry() {
      if (hasExpired.current) return;
      hasExpired.current = true;

      await fetch(`/api/waitlist/${waitlistId}/expire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      onExpired();
    }

    function calculate() {
      const diff = new Date(expiresAt).getTime() - Date.now();

      if (diff <= 0) {
        setTimeLeft("Expired");
        handleExpiry();
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs.toString().padStart(2, "0")}s`);
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, waitlistId, onExpired]);

  const isUrgent = timeLeft !== "Expired" && parseInt(timeLeft) < 10;

  return (
    <span
      className={`font-mono text-sm font-bold ${
        isUrgent ? "text-red-500" : "text-orange-500"
      }`}
    >
      {timeLeft}
    </span>
  );
}

// JOIN WAITLIST MODAL
function JoinWaitlistModal({
  appointments,
  onJoin,
  onClose,
  joining,
  error,
}: {
  appointments: any[];
  onJoin: (appointmentId: string) => void;
  onClose: () => void;
  joining: boolean;
  error: string;
}) {
  const [selected, setSelected] = useState("");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Join Waitlist</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Select a confirmed appointment to join the waitlist for. If an earlier
          slot opens up with your doctor, you will be notified via WhatsApp.
        </p>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {appointments.length === 0 ? (
          <p className="text-sm text-gray-400">
            You have no confirmed appointments available to join a waitlist for.
            Book and get a confirmation first.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-6">
              {appointments.map((appt) => (
                <button
                  key={appt._id}
                  onClick={() => setSelected(appt._id)}
                  className={`text-left border rounded-lg px-4 py-3 transition ${
                    selected === appt._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800">
                    Dr. {appt.doctorId?.name || "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(appt.date).toDateString()} · {appt.timeSlot}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    confirmed
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => selected && onJoin(selected)}
                disabled={!selected || joining}
                className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {joining ? "Joining..." : "Join Waitlist"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// MAIN PAGE
export default function WaitlistPage() {
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [confirmedAppts, setConfirmedAppts] = useState<any[]>([]);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  async function fetchWaitlist() {
    try {
      const res = await fetch("/api/waitlist", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      const active = (data.waitlist || []).filter((e: any) =>
        ["waiting", "notified"].includes(e.status),
      );
      setWaitlist(active);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWaitlist();

    // poll every 30 seconds to pick up status changes
    const interval = setInterval(fetchWaitlist, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleOpenModal() {
    setJoinError("");

    try {
      const [apptRes, waitlistRes] = await Promise.all([
        fetch("/api/appointments", {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch("/api/waitlist", {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ]);

      const apptData = await apptRes.json();
      const waitlistData = await waitlistRes.json();

      const activeWaitlistApptIds = new Set(
        (waitlistData.waitlist || [])
          .filter((e: any) => ["waiting", "notified"].includes(e.status))
          .map((e: any) => e.appointmentId?.toString()),
      );

      const eligible = (apptData.appointments || []).filter(
        (a: any) =>
          a.status === "confirmed" &&
          new Date(a.date) > new Date() &&
          !activeWaitlistApptIds.has(a._id?.toString()),
      );

      setConfirmedAppts(eligible);
      setShowModal(true);
    } catch {
      setJoinError("Failed to load appointments");
    }
  }

  async function handleJoin(appointmentId: string) {
    setJoining(true);
    setJoinError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ appointmentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setJoinError(data.error || "Failed to join waitlist");
        return;
      }

      setShowModal(false);
      await fetchWaitlist();
    } catch {
      setJoinError("Something went wrong");
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading waitlist...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-800">My Waitlist</h2>

        <button
          onClick={handleOpenModal}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          + Join Waitlist
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Join the waitlist for a confirmed appointment. If an earlier slot opens
        up with your doctor, you will be notified via WhatsApp and have 45
        minutes to accept or decline.
      </p>

      {waitlist.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">
            You are not on any waitlist currently.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Click &quot;Join Waitlist&apos; to get notified when an earlier slot
            opens up for a confirmed appointment.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Position",
                  "Doctor",
                  "My Appointment",
                  "Time Slot",
                  "Status",
                  "Offer Expires",
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
              {waitlist.map((entry) => (
                <tr
                  key={entry._id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-bold text-blue-600">
                    #{entry.position}
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {entry.doctorId?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(entry.date).toDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {entry.timeSlot || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.status === "notified"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.status === "notified" && entry.expiresAt ? (
                      <Countdown
                        expiresAt={entry.expiresAt}
                        waitlistId={entry._id}
                        onExpired={fetchWaitlist}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rejoin waitlist. future feature */}
      <div className="mt-6">
        <button
          disabled
          title="Available after accepting an earlier slot offer"
          className="text-sm px-4 py-2 border border-gray-200 text-gray-400 rounded cursor-not-allowed"
        >
          Rejoin Waitlist
        </button>
        <p className="text-xs text-gray-400 mt-1">
          Available after accepting an earlier slot offer.
        </p>
      </div>

      {showModal && (
        <JoinWaitlistModal
          appointments={confirmedAppts}
          onJoin={handleJoin}
          onClose={() => setShowModal(false)}
          joining={joining}
          error={joinError}
        />
      )}
    </div>
  );
}
