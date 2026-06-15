/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getToken } from "@/lib/auth/getSession";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";

function getFromToken(field: string): string {
  const token = getToken();
  if (!token) return "";
  try {
    return JSON.parse(atob(token.split(".")[1]))[field] || "";
  } catch {
    return "";
  }
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/appointments": "Appointments",
  "/dashboard/appointments/new": "Book Appointment",
  "/dashboard/waitlist": "Waitlist",
  "/dashboard/users": "Clinic Users",
  "/dashboard/my-patients": "My Patients",
  "/dashboard/health": "Health Profile",
  "/dashboard/my-records": "My Records",
  "/dashboard/settings": "Settings",
  "/dashboard/clinic": "My Clinic",
  "/dashboard/profile": "My Profile",
};

export default function AppBar() {
  const pathname = usePathname();

  const name = getFromToken("userId") ? getFromToken("name") : "";
  const profilePicture = getFromToken("profilePicture") || "";

  const pageTitle =
    PAGE_TITLES[pathname] ||
    Object.entries(PAGE_TITLES).find(
      ([key]) => pathname.startsWith(key) && key !== "/dashboard",
    )?.[1] ||
    "CareQueue";

  return (
    <header
      className="fixed top-0 right-0 z-40 bg-white border-b border-neutral-200 flex items-center justify-between px-6"
      style={{
        height: "var(--appbar-height)",
        left: "var(--sidebar-width)",
      }}
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-800">
          {pageTitle}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/settings"
          className="w-9 h-9 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors"
          title="Settings"
        >
          <SettingsOutlinedIcon
            sx={{ fontSize: 20, color: "var(--color-text-secondary)" }}
          />
        </Link>
        <Link
          href="/dashboard/profile"
          className="w-9 h-9 rounded-full overflow-hidden border-2 border-neutral-200 hover:border-primary transition-colors flex items-center justify-center bg-gradient-primary"
          title="My Profile"
        >
          {profilePicture ? (
            <Image
              src={profilePicture}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-xs font-bold">
              {name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
