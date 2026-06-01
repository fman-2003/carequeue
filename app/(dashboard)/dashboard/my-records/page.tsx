/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { getToken } from "@/lib/auth/getSession";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";

const ITEMS_PER_PAGE = 10;

export default function MyRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  // search state
  const [search, setSearch] = useState("");

  // filter and sort state
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetch("/api/ehr/visits/my-records", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => setRecords(data.records || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = [...records];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.doctorId?.name?.toLowerCase().includes(q) ||
          r.diagnosis?.toLowerCase().includes(q) ||
          r.prescriptions?.some((rx: any) =>
            rx.medication?.toLowerCase().includes(q),
          ),
      );
    }

    result.sort((a, b) => {
      const diff =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? diff : -diff;
    });

    return result;
  }, [records, search, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortOrder]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  if (loading) return <p className="text-gray-500">Loading your records...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">
        My Health Records
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Visit summaries from your appointments including prescriptions, lab
        tests, and follow-up details.
      </p>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <SearchInput
            placeholder="Search by doctor, diagnosis or medication..."
            onSearch={setSearch}
          />
        </div>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          className="border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        {search ? " found" : ""}
      </p>

      {/* Record detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Visit Summary</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Doctor
                  </p>
                  <p className="font-medium text-gray-800 mt-0.5">
                    Dr. {selected.doctorId?.name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Date
                  </p>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {new Date(
                      selected.appointmentId?.date || selected.createdAt,
                    ).toDateString()}
                  </p>
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Diagnosis
                </p>
                <p className="text-gray-700 bg-gray-50 rounded p-3">
                  {selected.diagnosis || "—"}
                </p>
              </div>

              {/* Prescriptions */}
              {selected.prescriptions?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Prescriptions
                  </p>
                  <div className="flex flex-col gap-2">
                    {selected.prescriptions.map((rx: any, i: number) => (
                      <div key={i} className="bg-blue-50 rounded p-3">
                        <p className="font-medium text-blue-800">
                          {rx.medication}
                        </p>
                        <p className="text-xs text-blue-600 mt-0.5">
                          {rx.dosage} · {rx.frequency} · {rx.duration}
                        </p>
                        {rx.instructions && (
                          <p className="text-xs text-blue-500 mt-0.5">
                            {rx.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab Tests */}
              {selected.labTestsOrdered?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Lab Tests Ordered
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selected.labTestsOrdered.map((lab: string, i: number) => (
                      <span
                        key={i}
                        className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full"
                      >
                        {lab}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow Up */}
              {selected.followUpDate && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Follow-Up Date
                  </p>
                  <p className="text-gray-700 font-medium">
                    {new Date(selected.followUpDate).toDateString()}
                  </p>
                </div>
              )}

              {/* Referral */}
              {selected.referral && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Referral
                  </p>
                  <p className="text-gray-700">{selected.referral}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {paginated.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">
            {search ? "No records match your search." : "No visit records yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {paginated.map((record) => (
            <button
              key={record._id}
              onClick={() => setSelected(record)}
              className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Dr. {record.doctorId?.name || "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(
                      record.appointmentId?.date || record.createdAt,
                    ).toDateString()}
                    {record.appointmentId?.timeSlot &&
                      ` · ${record.appointmentId.timeSlot}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 font-medium">
                    {record.diagnosis?.substring(0, 40)}
                    {record.diagnosis?.length > 40 ? "..." : ""}
                  </p>
                  {record.prescriptions?.length > 0 && (
                    <p className="text-xs text-blue-500 mt-0.5">
                      {record.prescriptions.length} prescription
                      {record.prescriptions.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
