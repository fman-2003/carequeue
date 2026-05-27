/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import {
  Chart, // the main Chart.js class — everything registers here
  Tooltip, // Chart.js tooltip plugin
  CategoryScale, // needed for 'category' axis type
  LinearScale, // needed for numeric scales
  PointElement, // needed for scatter points
  ScatterController,
} from "chart.js";

/**
 * Chart.js uses a plugin/registration system.
 * You must explicitly register every component you use.
 * This is different from Recharts where you just import and use.
 * The benefit is smaller bundle size — you only include what you need.
 */
Chart.register(
  Tooltip,
  CategoryScale,
  LinearScale,
  PointElement,
  ScatterController,
);

interface HeatmapPoint {
  x: string;
  y: string;
  v: number;
}

interface Props {
  data: { day: string; hour: string; count: number }[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = [
  "8:00",
  "9:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

export default function PeakHoursHeatmap({ data }: Props) {
  /**
   * useRef stores the canvas DOM element.
   * Chart.js renders directly onto an HTML <canvas> element —
   * it's not React components like Recharts, it's raw canvas drawing.
   * We need a ref to access the canvas imperatively.
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    /**
     * Destroy previous chart instance before creating a new one.
     * If we don't do this, Chart.js throws "Canvas is already in use"
     * error when React re-renders and the useEffect runs again.
     */
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    /**
     * Find the maximum count across all cells.
     * Used to normalise colours — the highest count
     * gets the darkest colour, everything else scales from it.
     */
    const maxCount = Math.max(...data.map((d) => d.count), 1);

    /**
     * Build the datasets array for Chart.js matrix chart.
     * Each entry is one cell in the heatmap grid.
     * x = hour label, y = day label, v = the actual count value.
     *
     * Note: Chart.js doesn't have a built-in matrix/heatmap chart.
     * We build it using a scatter chart where each point is a square.
     * This is a common workaround.
     */
    const points: HeatmapPoint[] = data.map((d) => ({
      x: d.hour,
      y: d.day,
      v: d.count,
    }));

    /**
     * Generate a colour for each cell based on its count.
     * Low count = light blue, high count = dark blue.
     * alpha (opacity) scales linearly with the count.
     */
    function getColor(count: number): string {
      if (count === 0) return "rgba(243, 244, 246, 1)";
      const intensity = count / maxCount;
      const alpha = 0.15 + intensity * 0.85;
      return `rgba(59, 130, 246, ${alpha.toFixed(2)})`;
    }

    const ctx = canvasRef.current.getContext("2d")!;

    chartRef.current = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            data: points as any,
            pointStyle: "rect",
            pointRadius: 18,
            pointHoverRadius: 20,
            backgroundColor: points.map((p) => getColor(p.v)),
            borderColor: "rgba(255,255,255,0.8)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: { raw: HeatmapPoint }) => {
                /**
                 * context.raw is typed as unknown by Chart.js.
                 * We cast it to our HeatmapPoint shape to access .v
                 */
                const point = context.raw as HeatmapPoint;
                return `${point.y} ${point.x} — ${point.v} appointment${point.v !== 1 ? "s" : ""}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "category",
            labels: HOURS,
            grid: { display: false },
            ticks: { font: { size: 11 }, color: "#9ca3af" },
          },
          y: {
            type: "category",
            labels: DAYS,
            grid: { display: false },
            ticks: { font: { size: 11 }, color: "#9ca3af" },
          },
        },
      } as any,
    });

    // cleanup — destroy chart when component unmounts
    return () => {
      chartRef.current?.destroy();
    };
  }, [data]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm font-semibold text-gray-700 mb-1">
        Peak Hours Heatmap
      </p>
      <p className="text-xs text-gray-400 mb-4">
        Darker = more appointments at that time
      </p>
      <canvas ref={canvasRef} />
    </div>
  );
}
