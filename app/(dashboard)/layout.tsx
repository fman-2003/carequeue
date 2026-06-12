"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, getToken, clearToken } from "@/lib/auth/getSession";
import AISchedulingPanel from "@/components/AISchedulingPanel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userName, setUserName] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const token = useMemo(() => getToken(), []);
  const role = useMemo(() => {
    try {
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role;
    } catch {
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    async function fetchUserData() {
      const userRes = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const userData = await userRes.json();
      if (role === "doctor" && userData.user) {
        setUserName(`Dr. ${userData.user.name || "Doctor"}`);
      }
      if (role === "admin" && userData.user) {
        setUserName(`Admin ${userData.user.name || "Admin"}`);
      }
      if (role === "receptionist" && userData.user) {
        setUserName(`Receptionist ${userData.user.name || "Receptionist"}`);
      }
      if (role === "patient" && userData.user) {
        setUserName(`Patient ${userData.user.name || "Patient"}`);
      }
    }
    fetchUserData();
  }, [router, token, role]);

  const handleLogout = () => {
    clearToken();
    return router.push("/login");
  };

  const navLinks = {
    admin: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/appointments", label: "Appointments" },
      { href: "/dashboard/users", label: "Users" },
      { href: "/dashboard/clinic", label: "My Clinic" },
    ],
    doctor: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/appointments", label: "Appointments" },
      { href: "/dashboard/my-patients", label: "My Patients" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
    patient: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/appointments", label: "Appointments" },
      { href: "/dashboard/appointments/new", label: "Book Slot" },
      { href: "/dashboard/waitlist", label: "Waitlist" },
      { href: "/dashboard/health", label: "Health Profile" },
      { href: "/dashboard/my-records", label: "My Records" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
    receptionist: [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/appointments", label: "Appointments" },
      { href: "/dashboard/appointments/new", label: "Book Slot" },
      { href: "/dashboard/waitlist", label: "Waitlist" },
    ],
  };

  const links = navLinks[role as keyof typeof navLinks] || [];

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0f172a] border-r border-[#0f172a] flex flex-col shrink-0 h-full">
        <div className="px-6 py-5 border-b border-[#0f172a]">
          <h1 className="text-lg font-bold text-white">CareQueue</h1>
          <p className="text-xs text-blue-200 capitalize mt-0.5">{userName}</p>
        </div>

        <nav className="flex-1 px-4 py-4 flex flex-col gap-1 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                pathname === link.href
                  ? "bg-white/10 text-white"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-[#0f172a]">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-white/10 rounded transition"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      {role === "patient" ? <AISchedulingPanel /> : null}
    </div>
  );
}
