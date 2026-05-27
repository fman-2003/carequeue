"use client";

import Link from "next/link";

interface ClinicGuardProps {
  hasClinic: boolean;
  role: string;
  children: React.ReactNode;
}

export default function ClinicGuard({
  hasClinic,
  role,
  children,
}: ClinicGuardProps) {
  if (!hasClinic) {
    const href = role === "admin" ? "/dashboard/clinic" : "/dashboard/settings";
    const message =
      role === "admin"
        ? "You need to create a clinic before accessing this page."
        : "You need to set your clinic in settings before accessing this page.";
    const label = role === "admin" ? "Create Clinic →" : "Go to Settings →";

    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500 text-sm text-center max-w-sm">{message}</p>
        <Link
          href={href}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          {label}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
