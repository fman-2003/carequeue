"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { month: string; count: number }[];
}

export default function MonthlyTrendChart({ data }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">
        Monthly Appointment Trend
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
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
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#colorCount)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
