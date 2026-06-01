/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { getToken } from "@/lib/auth/getSession";

const FILE_TYPES = [
  { value: "lab_result", label: "Lab Result" },
  { value: "scan", label: "Scan/Imaging" },
  { value: "referral", label: "Referral" },
  { value: "prescription", label: "Prescription" },
  { value: "other", label: "Other" },
];

const FILE_TYPE_STYLES: Record<string, string> = {
  lab_result: "bg-purple-50 text-purple-700",
  scan: "bg-blue-50 text-blue-700",
  referral: "bg-green-50 text-green-700",
  prescription: "bg-orange-50 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

interface Props {
  patientId: string;
  canUpload: boolean; // only patient and doctor
  appointmentId?: string;
}

export default function DocumentsSection({
  patientId,
  canUpload,
  appointmentId,
}: Props) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fileType, setFileType] = useState("lab_result");
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchDocuments() {
    try {
      const url = patientId
        ? `/api/ehr/documents?patientId=${patientId}`
        : "/api/ehr/documents";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setDocuments(data.documents || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PDF, JPG, PNG, and WEBP files are allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must be under 10MB");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patientId);
      formData.append("fileType", fileType);
      if (description) formData.append("description", description);
      if (appointmentId) formData.append("appointmentId", appointmentId);

      const res = await fetch("/api/ehr/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        // NOTE: do NOT set Content-Type here
        // the browser sets it automatically with the correct
        // multipart boundary when body is FormData
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
        return;
      }

      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocuments();
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;

    try {
      const res = await fetch(`/api/ehr/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d._id !== docId));
      }
    } catch {
      alert("Delete failed");
    }
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.startsWith("image")) return "🖼️";
    return "📎";
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading)
    return <p className="text-gray-500 text-sm">Loading documents...</p>;

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-4">
        Medical Documents
      </p>

      {canUpload && (
        <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-500 mb-3 font-medium">
            Upload Document
          </p>

          {uploadError && (
            <p className="text-red-500 text-xs mb-2">{uploadError}</p>
          )}

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Document Type
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-black"
                >
                  {FILE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-black"
                  placeholder="e.g. Blood test results"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                File (PDF, JPG, PNG — max 10MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleUpload}
                disabled={uploading}
                className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
              />
            </div>

            {uploading && (
              <p className="text-xs text-blue-600 animate-pulse">
                Uploading to secure storage...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Documents list */}
      {documents.length === 0 ? (
        <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(doc.mimeType)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {doc.fileName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${FILE_TYPE_STYLES[doc.fileType] || FILE_TYPE_STYLES.other}`}
                    >
                      {FILE_TYPES.find((t) => t.value === doc.fileType)
                        ?.label || doc.fileType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatFileSize(doc.fileSize)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(doc.createdAt).toDateString()}
                    </span>
                  </div>
                  {doc.description && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {doc.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View/Download button */}
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View
                </a>

                {canUpload && (
                  <button
                    onClick={() => handleDelete(doc._id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
