import {
  MAX_SERIES,
  type ChartData,
  type ChartPoint,
  type ChartSeries,
  type ChartSpec,
  type QueryResultSummary,
  type Source,
  type VisualData,
  type VisualSpec,
} from "./schema";

export function toSource(result: QueryResultSummary): Source {
  return {
    name: result.source,
    tableId: result.tableId,
    tableTitle: result.title,
    tableUrl: result.tableUrl,
    updated: result.updated,
    license: "CC BY 4.0",
  };
}

// Errors are written for the model, which sees them and can fix its spec.
export function buildVisual(
  spec: VisualSpec,
  result: QueryResultSummary,
): VisualData {
  if (result.rows.length === 0) {
    throw new Error(`The result from table ${result.tableId} has no rows.`);
  }
  if (spec.kind === "table") {
    return {
      kind: "table",
      title: spec.title,
      columns: result.columns,
      rows: result.rows,
      fixed: result.fixed,
      source: toSource(result),
    };
  }
  return buildChart(spec, result);
}

function buildChart(spec: ChartSpec, result: QueryResultSummary): ChartData {
  const dimensions = result.columns.slice(0, -1);
  const valueIndex = result.columns.length - 1;
  const xIndex = columnIndex(dimensions, spec.x);
  const seriesIndex =
    spec.series === undefined ? -1 : columnIndex(dimensions, spec.series);
  if (xIndex === seriesIndex) {
    throw new Error(`"x" and "series" must be different columns.`);
  }

  const unused = dimensions.filter((_, i) => i !== xIndex && i !== seriesIndex);
  if (unused.length > 0) {
    throw new Error(
      `Columns ${unused.join(", ")} also vary, so the chart would mix different numbers. Use them as x or series, query a single value for them, or show a table.`,
    );
  }

  const series: ChartSeries[] = [];
  const seriesKeys = new Map<string, string>();
  const points = new Map<string, ChartPoint>();

  for (const row of result.rows) {
    const label =
      seriesIndex === -1
        ? (result.measure ?? "Value")
        : String(row[seriesIndex]);
    let key = seriesKeys.get(label);
    if (key === undefined) {
      // Labels can contain dots, which chart libraries read as nested paths.
      key = `s${series.length}`;
      seriesKeys.set(label, key);
      series.push({ key, label });
    }

    const x = String(row[xIndex]);
    const point = points.get(x) ?? { x };
    point[key] = row[valueIndex];
    points.set(x, point);
  }

  if (series.length > MAX_SERIES) {
    throw new Error(
      `The chart would have ${series.length} series, over the limit of ${MAX_SERIES}. Query fewer values or show a table.`,
    );
  }

  return {
    kind: "chart",
    chartType: spec.chartType,
    title: spec.title,
    xLabel: spec.x,
    series,
    points: [...points.values()],
    fixed: result.fixed,
    source: toSource(result),
  };
}

function columnIndex(dimensions: string[], name: string) {
  const index = dimensions.indexOf(name);
  if (index === -1) {
    throw new Error(
      `No column "${name}" in the result. Use one of: ${dimensions.join(", ")}.`,
    );
  }
  return index;
}
