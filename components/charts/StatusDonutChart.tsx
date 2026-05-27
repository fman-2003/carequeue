"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { name: string; value: number; color: string }[];
}

export default function StatusDonutChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">
        Appointment Status Breakdown
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>

          <Tooltip
            formatter={(value) => {
              const numValue = typeof value === "number" ? value : 0;
              return [
                `${numValue} (${total > 0 ? Math.round((numValue / total) * 100) : 0}%)`,
                "Count",
              ];
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex justify-center -mt-2">
        <p className="text-xs text-gray-400">{total} total appointments</p>
      </div>
    </div>
  );
}
