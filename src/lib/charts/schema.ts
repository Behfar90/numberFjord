import { z } from "zod";

export const MAX_SERIES = 8;

const column = z
  .string()
  .min(1)
  .describe("A column name from the queryTable result, e.g. 'year'");

// The model names columns of a query result, never values, so it can't invent numbers.
export const visualSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("chart"),
    chartType: z
      .enum(["line", "bar"])
      .describe("line for change over time, bar for comparing categories"),
    title: z.string().min(1),
    x: column.describe("Column for the x axis, usually the time column"),
    series: column
      .optional()
      .describe(
        `Column whose values become separate lines or bars (at most ${MAX_SERIES})`,
      ),
  }),
  z.object({
    kind: z.literal("table"),
    title: z.string().min(1),
  }),
]);

export type VisualSpec = z.infer<typeof visualSpecSchema>;
export type ChartSpec = Extract<VisualSpec, { kind: "chart" }>;

export interface QueryResultSummary {
  tableId: string;
  title: string;
  updated: string;
  tableUrl: string;
  fixed: Record<string, string>;
  columns: string[];
  rows: (string | number | null)[][];
}

export interface Source {
  tableId: string;
  tableTitle: string;
  tableUrl: string;
  updated: string;
  license: "CC BY 4.0";
}

export interface ChartSeries {
  key: string;
  label: string;
}

export type ChartPoint = { x: string } & Record<string, string | number | null>;

export interface ChartData {
  kind: "chart";
  chartType: ChartSpec["chartType"];
  title: string;
  xLabel: string;
  series: ChartSeries[];
  points: ChartPoint[];
  fixed: Record<string, string>;
  source: Source;
}

export interface TableData {
  kind: "table";
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  fixed: Record<string, string>;
  source: Source;
}

export type VisualData = ChartData | TableData;
