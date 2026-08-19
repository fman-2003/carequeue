/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth/getSession";

export interface AnalyticsData {
  appointments: any[];
  statusBreakdown: { name: string; value: number; color: string }[];
  volumeOverTime: { date: string; count: number }[];
  noShowByDoctor: { doctor: string; rate: number; total: number }[];
  peakHours: { day: string; hour: string; count: number }[];
  riskDistribution: { band: string; count: number; color: string }[];
  monthlyTrend: { month: string; count: number }[];
  todayCount: number;
  pendingCount: number;
  totalCount: number;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData>();
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAndCompute() {
      try {
        const res = await fetch("/api/appointments", {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();

        if (json.error) {
          setError(json.error);
          return;
        }

        const appts: any[] = json.appointments || [];
        const now = new Date();
        const today = now.toDateString();

         // STATUS BREAKDOWN         
        const statusCounts: Record<string, number> = {
          confirmed: 0,
          pending: 0,
          cancelled: 0,
          completed: 0,
          "no-show": 0,
        };
        appts.forEach((a) => {
          if (statusCounts[a.status] !== undefined) {
            statusCounts[a.status]++;
          }
        });
        const statusBreakdown = [
          {
            name: "Confirmed",
            value: statusCounts.confirmed,
            color: "#22c55e",
          },
          { name: "Pending", value: statusCounts.pending, color: "#eab308" },
          {
            name: "Cancelled",
            value: statusCounts.cancelled,
            color: "#9ca3af",
          },
          {
            name: "Completed",
            value: statusCounts.completed,
            color: "#3b82f6",
          },
          { name: "No Show", value: statusCounts["no-show"], color: "#ef4444" },
        ];

        /**
         * VOLUME OVER TIME — last 14 days
         */
        const last14: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          last14[
            d.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })
          ] = 0;
        }
        appts.forEach((a) => {
          const label = new Date(a.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          });
          if (last14[label] !== undefined) last14[label]++;
        });
        const volumeOverTime = Object.entries(last14).map(([date, count]) => ({
          date,
          count,
        }));

        
         // NO-SHOW RATE BY DOCTOR 
        const doctorMap: Record<
          string,
          { noShow: number; closed: number; name: string }
        > = {};
        appts.forEach((a) => {
          const doctorId = a.doctorId?._id || a.doctorId;
          const doctorName = a.doctorId?.name || "Unknown";
          if (!doctorId) return;

          if (!doctorMap[doctorId]) {
            doctorMap[doctorId] = { noShow: 0, closed: 0, name: doctorName };
          }
          if (a.status === "no-show") {
            doctorMap[doctorId].noShow++;
            doctorMap[doctorId].closed++;
          }
          if (a.status === "completed") {
            doctorMap[doctorId].closed++;
          }
        });
        const noShowByDoctor = Object.values(doctorMap)
          .filter((d) => d.closed > 0)
          .map((d) => ({
            doctor: d.name,
            rate: Math.round((d.noShow / d.closed) * 100),
            total: d.closed,
          }));

        /**
         * PEAK HOURS HEATMAP DATA
         * For each appointment, record day of week + hour.
         * Used to build a 7x24 grid of appointment counts.
         */
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const hours = Array.from({ length: 10 }, (_, i) => `${i + 8}:00`);
        const heatmapMap: Record<string, number> = {};

        appts.forEach((a) => {
          const d = new Date(a.date);
          const day = days[d.getDay()];
          const hour = `${d.getHours()}:00`;
          const key = `${day}-${hour}`;
          heatmapMap[key] = (heatmapMap[key] || 0) + 1;
        });

        const peakHours: { day: string; hour: string; count: number }[] = [];
        days.forEach((day) => {
          hours.forEach((hour) => {
            peakHours.push({
              day,
              hour,
              count: heatmapMap[`${day}-${hour}`] || 0,
            });
          });
        });

         // RISK DISTRIBUTION         
        const riskBands = { low: 0, medium: 0, high: 0 };
        appts.forEach((a) => {
          if (a.noShowRisk == null) return;
          if (a.noShowRisk < 0.3) riskBands.low++;
          else if (a.noShowRisk < 0.7) riskBands.medium++;
          else riskBands.high++;
        });
        const riskDistribution = [
          { band: "Low Risk", count: riskBands.low, color: "#22c55e" },
          { band: "Medium Risk", count: riskBands.medium, color: "#eab308" },
          { band: "High Risk", count: riskBands.high, color: "#ef4444" },
        ];

        /**
         * MONTHLY TREND — last 6 months
         * Group appointments by month.
         * Used for the line chart on doctor dashboard.
         */
        const monthMap: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(now.getMonth() - i);
          const label = d.toLocaleDateString("en-GB", {
            month: "short",
            year: "2-digit",
          });
          monthMap[label] = 0;
        }
        appts.forEach((a) => {
          const label = new Date(a.date).toLocaleDateString("en-GB", {
            month: "short",
            year: "2-digit",
          });
          if (monthMap[label] !== undefined) monthMap[label]++;
        });
        const monthlyTrend = Object.entries(monthMap).map(([month, count]) => ({
          month,
          count,
        }));

        setData({
          appointments: appts,
          statusBreakdown,
          volumeOverTime,
          noShowByDoctor,
          peakHours,
          riskDistribution,
          monthlyTrend,
          todayCount: appts.filter(
            (a) => new Date(a.date).toDateString() === today,
          ).length,
          pendingCount: appts.filter((a) => a.status === "pending").length,
          totalCount: appts.length,
        });
      } catch {
        setError("Failed to load analytics data");
      } finally {
        setAnalyticsLoading(false);
      }
    }

    fetchAndCompute();
  }, []);

  return { data, analyticsLoading, error };
}
