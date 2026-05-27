"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { date: string; count: number }[];
  title: string;
}

export default function VolumeLineChart({ data, title }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
          />

          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />

          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          />

          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
