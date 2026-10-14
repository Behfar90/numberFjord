import type { ChartConfig } from "@/components/ui/chart";
import type { ChartData, ChartSeries } from "@/lib/charts/schema";

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

export function formatValue(value: string | number | null) {
  if (value === null) return "–";
  return typeof value === "number" ? value.toLocaleString() : value;
}

export function formatTick(value: number) {
  return compact.format(value);
}

// Colors follow the series' position, so the same result always gets the same colors.
export function chartConfig(series: ChartSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.label, color: `var(--chart-${i + 1})` },
    ]),
  );
}

export function chartToTable(chart: ChartData) {
  return {
    columns: [chart.xLabel, ...chart.series.map((s) => s.label)],
    rows: chart.points.map((point) => [
      point.x,
      ...chart.series.map((s) => point[s.key] ?? null),
    ]),
  };
}

export function describeFixed(fixed: Record<string, string>) {
  return Object.entries(fixed)
    .map(([dimension, value]) => `${dimension}: ${value}`)
    .join(" · ");
}
