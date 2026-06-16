/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getToken, saveToken } from "@/lib/auth/getSession";
import ConfirmModal from "@/components/ConfirmModal";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import PageWrapper from "@/components/layout/PageWrapper";
import { styles } from "@/app/styles";

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/users/profile", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setProfile(data.user);
          setForm({
            name: data.user.name || "",
            email: data.user.email || "",
            phone: data.user.phone || "",
          });
          if (data.user.profilePicture) {
            setPreviewUrl(data.user.profilePicture);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // show local preview immediately
    // const objectUrl = URL.createObjectURL(file);
    // setPreviewUrl(objectUrl);

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("profilePicture", file);

      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      // URL.revokeObjectURL(objectUrl);

      const freshUrl = `${data.user.profilePicture}?t=${Date.now()}`;

      setProfile(data.user);
      setPreviewUrl(freshUrl);
      setMessage("Profile picture updated ✅");
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setShowModal(false);
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "object"
            ? Object.values(data.error).flat().join(", ")
            : data.error || "Failed to save";
        setError(msg);
        return;
      }

      if (data.token) saveToken(data.token);
      setProfile(data.user);
      setMessage("Profile updated successfully ✅");
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-400">Loading profile...</p>
        </div>
      </PageWrapper>
    );

  return (
    <PageWrapper>
      <div className="max-w-lg">
        <div className="bg-white border shadow-strong mx-auto border-neutral-200 rounded-xl p-6 flex flex-col gap-3 text-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 hover:text-neutral-500 flex items-center justify-center transition-colors"
            >
              <ArrowBackOutlinedIcon
                sx={{ fontSize: 20, color: "var(--color-text-neutral)" }}
              />{" "}
              Back
            </button>
            <div>
              <p className="page-subtitle">
                Update your profile information and profile picture.
              </p>
            </div>
          </div>

          {message && (
            <div className="bg-success-light text-success-text text-sm px-4 py-3 rounded-lg mb-4 border border-success/20">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-error-light text-error-text text-sm px-4 py-3 rounded-lg mb-4 border border-error/20">
              {error}
            </div>
          )}

          {/* Avatar section */}
          <div className={`${styles.card} p-6 mb-4`}>
            <h3 className="section-title mb-5">Profile Picture</h3>
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-neutral-200 bg-gradient-primary flex items-center justify-center">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-2xl font-bold">
                      {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                </div>
                {/* Upload overlay */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-white flex items-center justify-center hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  <CameraAltOutlinedIcon
                    sx={{ fontSize: 14, color: "white" }}
                  />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-neutral-700">
                  {profile?.name}
                </p>
                <p className="text-xs text-neutral-400 capitalize mt-0.5">
                  {profile?.role}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-primary hover:text-primary-dark mt-2 font-medium disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Change photo"}
                </button>
                <p className="text-xs text-neutral-400 mt-0.5">
                  JPG, PNG, WEBP — max 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Profile info form */}
          <div className={`${styles.card} p-6`}>
            <h3 className="section-title mb-5">Personal Information</h3>

            <div className="flex flex-col gap-4">
              <div>
                <label className={`${styles.label}`}>Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="text-black w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className={`${styles.label}`}>Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="text-black w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className={`${styles.label}`}>Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="text-black w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+2348012345678"
                />
              </div>
              <div>
                <label className={`${styles.label}`}>Role</label>
                <div
                  className={`${styles.input} bg-neutral-50 cursor-not-allowed capitalize text-neutral-500`}
                >
                  {profile?.role}
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Your role cannot be changed after registration.
                </p>
              </div>

              <button
                onClick={() => setShowModal(true)}
                disabled={saving}
                className={`${styles.btnPrimary} w-full mt-2`}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {showModal && (
            <ConfirmModal
              title="Update Profile"
              message="Are you sure you want to save these changes to your profile?"
              confirmText="Yes, Save"
              onConfirm={handleSave}
              onCancel={() => setShowModal(false)}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
