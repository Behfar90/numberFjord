import { describe, expect, it } from "vitest";

import { buildVisual } from "./build";
import {
  MAX_SERIES,
  visualSpecSchema,
  type QueryResultSummary,
} from "./schema";

const result: QueryResultSummary = {
  tableId: "07459",
  title: "Population, by region, sex, age, contents and year",
  updated: "2026-02-19",
  tableUrl: "https://www.ssb.no/en/statbank/table/07459",
  fixed: { region: "Oslo - Oslove", contents: "Persons" },
  columns: ["sex", "year", "value"],
  rows: [
    ["Males", "2025", 358101],
    ["Males", "2026", 361048],
    ["Females", "2025", 359609],
    ["Females", "2026", null],
  ],
};

const source = {
  tableId: "07459",
  tableTitle: "Population, by region, sex, age, contents and year",
  tableUrl: "https://www.ssb.no/en/statbank/table/07459",
  updated: "2026-02-19",
  license: "CC BY 4.0",
};

describe("visualSpecSchema", () => {
  it("accepts a chart spec and a table spec", () => {
    expect(
      visualSpecSchema.safeParse({
        kind: "chart",
        chartType: "line",
        title: "Population",
        x: "year",
      }).success,
    ).toBe(true);
    expect(
      visualSpecSchema.safeParse({ kind: "table", title: "Population" })
        .success,
    ).toBe(true);
  });

  it("rejects unknown chart types", () => {
    expect(
      visualSpecSchema.safeParse({
        kind: "chart",
        chartType: "pie",
        title: "Population",
        x: "year",
      }).success,
    ).toBe(false);
  });
});

describe("buildVisual", () => {
  it("pivots rows into one point per x value with a key per series", () => {
    const chart = buildVisual(
      {
        kind: "chart",
        chartType: "line",
        title: "Population of Oslo",
        x: "year",
        series: "sex",
      },
      result,
    );

    expect(chart).toEqual({
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
      source,
    });
  });

  it("uses a single series when no series column is given", () => {
    const chart = buildVisual(
      { kind: "chart", chartType: "bar", title: "Oslo", x: "year" },
      { ...result, columns: ["year", "value"], rows: [["2025", 717710]] },
    );

    expect(chart).toMatchObject({
      series: [{ key: "s0", label: "value" }],
      points: [{ x: "2025", s0: 717710 }],
    });
  });

  it("passes rows through for a table", () => {
    expect(buildVisual({ kind: "table", title: "Oslo" }, result)).toEqual({
      kind: "table",
      title: "Oslo",
      columns: result.columns,
      rows: result.rows,
      fixed: result.fixed,
      source,
    });
  });

  it("rejects a chart when another column also varies", () => {
    expect(() =>
      buildVisual(
        { kind: "chart", chartType: "line", title: "Oslo", x: "year" },
        result,
      ),
    ).toThrow(/Columns sex also vary/);
  });

  it("rejects unknown columns and lists the valid ones", () => {
    expect(() =>
      buildVisual(
        { kind: "chart", chartType: "line", title: "Oslo", x: "Tid" },
        result,
      ),
    ).toThrow('No column "Tid" in the result. Use one of: sex, year.');
  });

  it("rejects using the same column for x and series", () => {
    expect(() =>
      buildVisual(
        {
          kind: "chart",
          chartType: "line",
          title: "Oslo",
          x: "year",
          series: "year",
        },
        result,
      ),
    ).toThrow(/must be different/);
  });

  it(`rejects more than ${MAX_SERIES} series`, () => {
    const rows = Array.from({ length: MAX_SERIES + 1 }, (_, i) => [
      `Region ${i}`,
      "2026",
      i,
    ]);
    expect(() =>
      buildVisual(
        {
          kind: "chart",
          chartType: "bar",
          title: "Regions",
          x: "year",
          series: "region",
        },
        { ...result, columns: ["region", "year", "value"], rows },
      ),
    ).toThrow(/over the limit/);
  });

  it("rejects an empty result", () => {
    expect(() =>
      buildVisual({ kind: "table", title: "Oslo" }, { ...result, rows: [] }),
    ).toThrow(/no rows/);
  });
});
