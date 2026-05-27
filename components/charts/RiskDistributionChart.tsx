"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { band: string; count: number; color: string }[];
}

export default function RiskDistributionChart({ data }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm font-semibold text-gray-700 mb-1">
        No-Show Risk Distribution
      </p>
      <p className="text-xs text-gray-400 mb-4">
        Based on AI prediction scores for upcoming appointments
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f0f0f0"
            vertical={false}
          />
          <XAxis
            dataKey="band"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => {
              const numValue = typeof value === "number" ? value : 0;
              return [numValue, "Appointments"];
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
