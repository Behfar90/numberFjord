import { describe, expect, it } from "vitest";

import type { ChartData } from "@/lib/charts/schema";

import {
  chartConfig,
  chartToTable,
  describeFixed,
  formatValue,
} from "./visual-data";

const chart: ChartData = {
  kind: "chart",
  chartType: "line",
  title: "Population of Oslo",
  xLabel: "year",
  series: [
    { key: "s0", label: "Males" },
    { key: "s1", label: "Females" },
  ],
  points: [
    { x: "2025", s0: 358101, s1: 359609 },
    { x: "2026", s0: 361048, s1: null },
  ],
  fixed: { region: "Oslo - Oslove", contents: "Persons" },
  source: {
    name: "Statistics Norway",
    tableId: "07459",
    tableTitle: "Population",
    tableUrl: "https://www.ssb.no/en/statbank/table/07459",
    updated: "2026-02-19",
    license: "CC BY 4.0",
  },
};

describe("chartConfig", () => {
  it("gives each series the theme color for its position", () => {
    expect(chartConfig(chart.series)).toEqual({
      s0: { label: "Males", color: "var(--chart-1)" },
      s1: { label: "Females", color: "var(--chart-2)" },
    });
  });
});

describe("chartToTable", () => {
  it("turns points back into rows with one column per series", () => {
    expect(chartToTable(chart)).toEqual({
      columns: ["year", "Males", "Females"],
      rows: [
        ["2025", 358101, 359609],
        ["2026", 361048, null],
      ],
    });
  });
});

describe("formatValue", () => {
  it("shows missing values as a dash and leaves labels alone", () => {
    expect(formatValue(null)).toBe("–");
    expect(formatValue("2025")).toBe("2025");
  });
});

describe("describeFixed", () => {
  it("joins the dimensions that have a single value", () => {
    expect(describeFixed(chart.fixed)).toBe(
      "region: Oslo - Oslove · contents: Persons",
    );
  });
});
