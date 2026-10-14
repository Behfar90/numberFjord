"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartData } from "@/lib/charts/schema";

import { chartConfig, formatTick } from "./visual-data";

// Markers help on short lines but turn into noise on long ones.
const MAX_POINTS_WITH_DOTS = 12;

export function VisualChart({ chart }: { chart: ChartData }) {
  const config = chartConfig(chart.series);
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="x" tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        width={48}
        tickFormatter={formatTick}
      />
      <ChartTooltip content={<ChartTooltipContent />} />
      {chart.series.length > 1 && (
        <ChartLegend content={<ChartLegendContent />} />
      )}
    </>
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      {chart.chartType === "line" ? (
        <LineChart data={chart.points} accessibilityLayer>
          {axes}
          {chart.series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="linear"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              dot={
                chart.points.length <= MAX_POINTS_WITH_DOTS
                  ? { r: 4, fill: `var(--color-${s.key})` }
                  : false
              }
            />
          ))}
        </LineChart>
      ) : (
        <BarChart data={chart.points} barGap={2} accessibilityLayer>
          {axes}
          {chart.series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );
}
