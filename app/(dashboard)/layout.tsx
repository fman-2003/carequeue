/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearToken, getToken } from "@/lib/auth/getSession";
import AISchedulingPanel from "@/components/layout/AISchedulingPanel";
import AppBar from "@/components/layout/AppBar";

// MUI Icons
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import HealingOutlinedIcon from "@mui/icons-material/HealingOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import MedicalInformationOutlinedIcon from "@mui/icons-material/MedicalInformationOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LocalHospitalOutlinedIcon from "@mui/icons-material/LocalHospitalOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

interface NavLink {
  href: string;
  label: string;
  Icon: SvgIconComponent;
}

function getRoleFromToken(): string {
  const token = getToken();
  if (!token) return "";
  try {
    return JSON.parse(atob(token.split(".")[1])).role;
  } catch {
    return "";
  }
}

function getNameFromToken(): string {
  const token = getToken();
  if (!token) return "";
  try {
    return JSON.parse(atob(token.split(".")[1])).name || "";
  } catch {
    return "";
  }
}

const NAV_LINKS: Record<string, NavLink[]> = {
  admin: [
    { href: "/dashboard", label: "Overview", Icon: DashboardOutlinedIcon },
    {
      href: "/dashboard/appointments",
      label: "Appointments",
      Icon: CalendarMonthOutlinedIcon,
    },
    { href: "/dashboard/users", label: "Users", Icon: PeopleAltOutlinedIcon },
    {
      href: "/dashboard/clinic",
      label: "My Clinic",
      Icon: LocalHospitalOutlinedIcon,
    },
  ],
  doctor: [
    { href: "/dashboard", label: "Overview", Icon: DashboardOutlinedIcon },
    {
      href: "/dashboard/appointments",
      label: "Appointments",
      Icon: CalendarMonthOutlinedIcon,
    },
    {
      href: "/dashboard/appointments/new",
      label: "Book Slot",
      Icon: AddCircleOutlineIcon,
    },
    {
      href: "/dashboard/my-patients",
      label: "My Patients",
      Icon: PeopleAltOutlinedIcon,
    },
  ],
  receptionist: [
    { href: "/dashboard", label: "Overview", Icon: DashboardOutlinedIcon },
    {
      href: "/dashboard/appointments",
      label: "Appointments",
      Icon: CalendarMonthOutlinedIcon,
    },
    {
      href: "/dashboard/appointments/new",
      label: "Book Slot",
      Icon: AddCircleOutlineIcon,
    },
    {
      href: "/dashboard/waitlist",
      label: "Waitlist",
      Icon: ListAltOutlinedIcon,
    },
  ],
  patient: [
    { href: "/dashboard", label: "Overview", Icon: DashboardOutlinedIcon },
    {
      href: "/dashboard/appointments",
      label: "Appointments",
      Icon: CalendarMonthOutlinedIcon,
    },
    {
      href: "/dashboard/appointments/new",
      label: "Book Slot",
      Icon: AddCircleOutlineIcon,
    },
    {
      href: "/dashboard/waitlist",
      label: "Waitlist",
      Icon: ListAltOutlinedIcon,
    },
    {
      href: "/dashboard/health",
      label: "Health Profile",
      Icon: HealingOutlinedIcon,
    },
    {
      href: "/dashboard/my-records",
      label: "My Records",
      Icon: FolderOpenOutlinedIcon,
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      Icon: SettingsOutlinedIcon,
    },
  ],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    function setStates() {
      setRole(getRoleFromToken());
      setName(getNameFromToken());
    }
    setStates();
  }, [router]);

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const links = NAV_LINKS[role] || [];

  return (
    <div className="h-screen flex overflow-hidden bg-neutral-50">
      <aside
        className="flex flex-col shrink-0 h-full bg-neutral-900"
        style={{ width: "var(--sidebar-width)" }}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">CQ</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">
              CareQueue
            </h1>
            <p className="text-xs text-neutral-400 capitalize mt-0.5">{role}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {links.map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-white shadow-primary/30 shadow-sm"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon sx={{ fontSize: 18 }} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors mb-1"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {name || "User"}
              </p>
              <p className="text-xs text-neutral-500 capitalize">{role}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-white/5 hover:text-red-400 transition-all text-sm"
          >
            <LogoutOutlinedIcon sx={{ fontSize: 18 }} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppBar />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ paddingTop: "calc(var(--appbar-height) + 1.5rem)" }}
        >
          {children}
        </main>
      </div>
      <AISchedulingPanel />
    </div>
  );
}
