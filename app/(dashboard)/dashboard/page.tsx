/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth/getSession";
import ClinicGuard from "@/components/ClinicGuard";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import VolumeLineChart from "@/components/charts/VolumeLineChart";
import StatusDonutChart from "@/components/charts/StatusDonutChart";
import NoShowBarChart from "@/components/charts/NoShowBarChart";
import PeakHoursHeatmap from "@/components/charts/PeakHoursHeatmap";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import RiskDistributionChart from "@/components/charts/RiskDistributionChart";
import PageTour from "@/components/ui/PageTour";
import { TOURS } from "@/lib/tour";
import PageWrapper from "@/components/layout/PageWrapper";

function getRoleFromToken(): string {
  const token = getToken();
  console.log("Token in DashboardPage:", token);
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

function AdminOverview() {
  const clinicId = getClinicIdFromToken();
  const role = getRoleFromToken();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data, analyticsLoading, error } = useAnalytics();

  useEffect(() => {
    fetch("/api/appointments", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const appointments = data.appointments || [];
        setStats({
          total: appointments.length,
          today: appointments.filter(
            (a: { date: string | number | Date }) =>
              new Date(a.date).toDateString() === new Date().toDateString(),
          ).length,
          confirmed: appointments.filter((a: any) => a.status === "confirmed")
            .length,
          pending: appointments.filter((a: any) => a.status === "pending")
            .length,
          noShow: appointments.filter((a: any) => a.status === "no-show")
            .length,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading...</p>
      </PageWrapper>
    );

  if (analyticsLoading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading analytics...</p>
      </PageWrapper>
    );
  if (error && clinicId)
    return (
      <PageWrapper>
        <p className="text-red-500">{error}</p>
      </PageWrapper>
    );

  return (
    <PageWrapper>
      <PageTour tourId="admin-dashboard" steps={TOURS.admin.dashboard} />

      <ClinicGuard hasClinic={!!clinicId} role={role}>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total", value: stats.total },
              { label: "Today", value: stats.today },
              { label: "Pending", value: stats.pending },
              {
                label: "No Shows",
                value: stats.noShow,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-primary rounded-lg border border-primary-300 p-5"
              >
                <p className="text-sm text-gray-100">{card.label}</p>
                <p className="text-3xl font-bold text-gray-50 mt-1">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <VolumeLineChart
                  data={data.volumeOverTime}
                  title="Appointments — Last 14 Days"
                />
                <StatusDonutChart data={data.statusBreakdown} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <NoShowBarChart data={data.noShowByDoctor} />
                <PeakHoursHeatmap data={data.peakHours} />
              </div>
            </>
          ) : (
            <h3 className="text-center text-gray-500">
              No analytics currently available. Select a clinic to access
              analytics.
            </h3>
          )}
        </div>
      </ClinicGuard>
    </PageWrapper>
  );
}

function DoctorOverview() {
  const clinicId = getClinicIdFromToken();
  const role = getRoleFromToken();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { data, analyticsLoading, error } = useAnalytics();

  useEffect(() => {
    fetch("/api/appointments", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => setAppointments(data.appointments || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading...</p>
      </PageWrapper>
    );

  if (analyticsLoading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading...</p>
      </PageWrapper>
    );
  if (error && clinicId)
    return (
      <PageWrapper>
        <p className="text-red-500">{error}</p>
      </PageWrapper>
    );

  const today = new Date().toDateString();
  const todayAppointments = appointments.filter(
    (a) => new Date(a.date).toDateString() === today,
  );

  if (!data) {
    return (
      <PageWrapper>
        <PageTour tourId="doctor-dashboard" steps={TOURS.doctor.dashboard} />

        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-primary rounded-lg border border-primary-300 p-5">
              <p className="text-sm text-gray-100">Today&apos;s Appointments</p>
              <p className="text-3xl font-bold text-gray-50 mt-1">
                {todayAppointments.length}
              </p>
            </div>
            <div className="bg-primary rounded-lg border border-primary-300 p-5">
              <p className="text-sm text-gray-100">Total Appointments</p>
              <p className="text-3xl font-bold text-gray-50 mt-1">
                {appointments.length}
              </p>
            </div>
            <div className="bg-primary rounded-lg border border-primary-300 p-5">
              <p className="text-sm text-gray-100">Pending Confirmation</p>
              <p className="text-3xl font-bold text-gray-50 mt-1">
                {appointments.filter((a) => a.status === "pending").length}
              </p>
            </div>
          </div>

          <h3 className="text-center text-gray-500">
            No analytics currently available. Select a clinic to access
            analytics.
          </h3>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PageTour tourId="doctor-dashboard" steps={TOURS.doctor.dashboard} />

      <ClinicGuard hasClinic={!!clinicId} role={role}>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-primary rounded-lg border border-primary-300 p-5">
              <p className="text-sm text-gray-100">Today&apos;s Appointments</p>
              <p className="text-3xl font-bold text-gray-50 mt-1">
                {data.todayCount}
              </p>
            </div>
            <div className="bg-primary rounded-lg border border-primary-300 p-5">
              <p className="text-sm text-gray-100">Total Appointments</p>
              <p className="text-3xl font-bold text-gray-50 mt-1">
                {data.totalCount}
              </p>
            </div>
            <div className="bg-primary rounded-lg border border-primary-300 p-5">
              <p className="text-sm text-gray-100">Pending Confirmation</p>
              <p className="text-3xl font-bold text-gray-50 mt-1">
                {data.pendingCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <MonthlyTrendChart data={data.monthlyTrend} />
            <RiskDistributionChart data={data.riskDistribution} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <StatusDonutChart data={data.statusBreakdown} />
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Today&apos;s Schedule
              </p>
              {todayAppointments.length === 0 ? (
                <p className="text-sm text-gray-400">No appointments today.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {todayAppointments.map((appt) => (
                    <div
                      key={appt._id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {appt.patientId?.name || "—"}
                        </p>
                        <p className="text-xs text-gray-500">{appt.timeSlot}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          appt.status === "confirmed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </ClinicGuard>
    </PageWrapper>
  );
}

function PatientOverview() {
  const role = getRoleFromToken();
  const clinicId = getClinicIdFromToken();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [preferredDoctor, setPreferredDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data, analyticsLoading, error } = useAnalytics();

  useEffect(() => {
    async function fetchData() {
      try {
        const [apptRes, profileRes] = await Promise.all([
          fetch("/api/appointments", {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
        ]);

        const apptData = await apptRes.json();
        const profileData = await profileRes.json();

        setAppointments(apptData.appointments || []);

        if (profileData.user?.preferredDoctorId) {
          setPreferredDoctor(profileData.user.preferredDoctorId);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading...</p>
      </PageWrapper>
    );

  const upcoming = appointments
    .filter((a) => new Date(a.date) >= new Date() && a.status !== "cancelled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  if (analyticsLoading)
    return (
      <PageWrapper>
        <p className="text-gray-500">Loading...</p>
      </PageWrapper>
    );
  if (error && clinicId)
    return (
      <PageWrapper>
        <p className="text-red-500">{error}</p>
      </PageWrapper>
    );
  // if (!data) return null;

  return (
    <PageWrapper>
      <PageTour tourId="patient-dashboard" steps={TOURS.patient.dashboard} />

      <ClinicGuard hasClinic={!!clinicId} role={role}>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {/* Doctor Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-sm font-medium text-gray-500 mb-3">
                My Doctor
              </p>
              {preferredDoctor ? (
                <div>
                  <p className="text-base font-bold text-gray-800">
                    {preferredDoctor.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {preferredDoctor.email}
                  </p>
                  {preferredDoctor.phone && (
                    <p className="text-sm text-gray-500">
                      {preferredDoctor.phone}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 mb-3">
                    No preferred doctor selected yet.
                  </p>
                  <Link
                    href="/dashboard/settings"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Select a preferred doctor →
                  </Link>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 md:col-span-2">
              <p className="text-sm font-medium text-gray-500 mb-3">
                Upcoming Appointments
              </p>
              {upcoming.length === 0 ? (
                <div>
                  <p className="text-sm text-gray-400 mb-3">
                    No upcoming appointments.
                  </p>
                  <Link
                    href="/dashboard/appointments/new"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Book an appointment →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcoming.map((appt) => (
                    <div
                      key={appt._id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Dr. {appt.doctorId?.name || "—"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(appt.date).toDateString()} · {appt.timeSlot}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          appt.status === "confirmed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {data && (
            <VolumeLineChart
              data={data.volumeOverTime}
              title="My Appointment Activity — Last 14 Days"
            />
          )}
        </div>
      </ClinicGuard>
    </PageWrapper>
  );
}

export default function DashboardPage() {
  const role = getRoleFromToken();

  if (role === "admin") return <AdminOverview />;
  if (role === "doctor") return <DoctorOverview />;
  if (role === "patient") return <PatientOverview />;
}
