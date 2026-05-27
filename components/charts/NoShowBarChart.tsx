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
  data: { doctor: string; rate: number; total: number }[];
}

export default function NoShowBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">
          No-Show Rate by Doctor
        </p>
        <p className="text-sm text-gray-400">
          Not enough completed appointment data yet.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">
        No-Show Rate by Doctor
      </p>

      <ResponsiveContainer width="100%" height={250}>
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
            dataKey="doctor"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            tickFormatter={(val: string) => val.split(" ")[0]}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: number) => `${val}%`}
            domain={[0, 100]}
          />

          <Tooltip
            formatter={(value, _name, props) => {
              const numValue = typeof value === "number" ? value : 0;
              const total = props?.payload?.total ?? 0;

              return [`${numValue}% (${total} appointments)`, "No-Show Rate"];
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          />

          <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.rate < 20
                    ? "#22c55e"
                    : entry.rate < 40
                      ? "#eab308"
                      : "#ef4444"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
