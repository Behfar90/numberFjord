import { tool } from "ai";
import { z } from "zod";

import { toRows } from "@/lib/jsonstat";
import {
  estimateCells,
  type Dimension,
  type PxClient,
  type QueryResult,
  type Selection,
  type TableMetadata,
  type TableSummary,
} from "@/lib/ssb";

const SEARCH_PAGE_SIZE = 10;
const MAX_LISTED_VALUES = 40;
const MAX_EXAMPLES = 10;
const MAX_MATCHES = 20;
// Far below the API limit: every cell is resent to the model on each later step.
export const MAX_QUERY_CELLS = 500;

export function summarizeTable(table: TableSummary) {
  return {
    id: table.id,
    title: table.label.replace(`${table.id}: `, ""),
    period: `${table.firstPeriod}–${table.lastPeriod}`,
    frequency: table.timeUnit,
    updated: table.updated.slice(0, 10),
    variables: table.variableNames,
  };
}

export function summarizeMetadata(meta: TableMetadata, search: string[] = []) {
  const terms = search.map((s) => s.toLowerCase());
  const dimensions = meta.dimensions.map((dim) =>
    summarizeDimension(dim, dim.code === meta.timeDimension, terms),
  );
  return {
    tableId: meta.id,
    title: meta.label,
    updated: meta.updated.slice(0, 10),
    tableUrl: meta.tableUrl,
    dimensions,
    ...(dimensions.some((d) => "examples" in d) && {
      hint: 'Some dimensions only show examples. Call again with "search" to find the codes you need.',
    }),
  };
}

function summarizeDimension(dim: Dimension, isTime: boolean, terms: string[]) {
  const base = {
    code: dim.code,
    label: dim.label,
    required: !dim.elimination,
    valueCount: dim.values.length,
  };
  if (isTime) {
    return {
      ...base,
      isTime: true,
      first: dim.values[0]?.code,
      last: dim.values.at(-1)?.code,
    };
  }
  if (dim.values.length <= MAX_LISTED_VALUES) {
    return { ...base, values: dim.values };
  }
  const matches = dim.values
    .filter((v) =>
      terms.some(
        (t) => v.label.toLowerCase().includes(t) || v.code.toLowerCase() === t,
      ),
    )
    .slice(0, MAX_MATCHES);
  return matches.length > 0
    ? { ...base, matches }
    : { ...base, examples: dim.values.slice(0, MAX_EXAMPLES) };
}

export interface SelectionInput {
  dimension: string;
  values?: string[];
  latest?: number;
}

// Errors are written for the model, which sees them and can fix its query.
export function buildSelection(
  meta: TableMetadata,
  input: SelectionInput[],
): Selection {
  const selection: Selection = {};

  for (const { dimension, values, latest } of input) {
    const dim = meta.dimensions.find((d) => d.code === dimension);
    if (!dim) {
      const codes = meta.dimensions.map((d) => d.code).join(", ");
      throw new Error(
        `Table ${meta.id} has no dimension "${dimension}". Its dimensions are: ${codes}.`,
      );
    }
    if ((values === undefined) === (latest === undefined)) {
      throw new Error(
        `Give either "values" or "latest" for ${dim.code}, not both or neither.`,
      );
    }
    if (latest !== undefined) {
      if (dim.code !== meta.timeDimension) {
        throw new Error(
          `"latest" only works on the time dimension${meta.timeDimension ? ` (${meta.timeDimension})` : ""}.`,
        );
      }
      selection[dim.code] = { top: Math.min(latest, dim.values.length) };
    } else if (values) {
      const known = new Set(dim.values.map((v) => v.code));
      const unknown = values.filter((v) => !known.has(v));
      if (unknown.length > 0) {
        throw new Error(
          `Unknown value codes for ${dim.code}: ${unknown.join(", ")}. Use codes, not labels, from getTableMetadata.`,
        );
      }
      selection[dim.code] = values;
    }
  }

  for (const dim of meta.dimensions) {
    if (selection[dim.code] || dim.elimination) continue;
    if (dim.values.length === 1) {
      selection[dim.code] = [dim.values[0].code];
    } else {
      throw new Error(
        `Dimension ${dim.code} (${dim.label}) is required. Select values for it.`,
      );
    }
  }

  const cells = estimateCells(selection) ?? 0;
  if (cells > MAX_QUERY_CELLS) {
    throw new Error(
      `This selection is ${cells} cells, over the limit of ${MAX_QUERY_CELLS}. Select fewer values, or leave out optional dimensions to get totals.`,
    );
  }
  return selection;
}

// Dimensions with a single value move to `fixed`, so rows stay short.
export function summarizeResult(result: QueryResult) {
  const { dataset } = result;
  const rows = toRows(dataset);
  const fixed: Record<string, string> = {};
  const varying: string[] = [];
  dataset.id.forEach((code, i) => {
    if (dataset.size[i] === 1) {
      fixed[dataset.dimension[code].label] = rows[0]?.labels[code] ?? "";
    } else {
      varying.push(code);
    }
  });

  return {
    tableId: result.tableId,
    title: dataset.label,
    updated: dataset.updated.slice(0, 10),
    source: result.source,
    tableUrl: result.tableUrl,
    sourceUrl: result.sourceUrl,
    ...(dataset.note && { notes: dataset.note }),
    fixed,
    columns: [...varying.map((code) => dataset.dimension[code].label), "value"],
    rows: rows.map((row) => [
      ...varying.map((code) => row.labels[code]),
      row.value,
    ]),
  };
}

export function createPxTools(client: PxClient) {
  const { sourceName } = client.config;
  const metadataCache = new Map<string, TableMetadata>();

  async function getMetadata(tableId: string, signal?: AbortSignal) {
    let meta = metadataCache.get(tableId);
    if (!meta) {
      meta = await client.getTableMetadata(tableId, { signal });
      metadataCache.set(tableId, meta);
    }
    return meta;
  }

  return {
    searchTables: tool({
      description: `Search ${sourceName} for statistics tables by keywords. Always start here. Returns up to ${SEARCH_PAGE_SIZE} tables with id, title, period covered and variables. Prefer tables that cover the most recent period.`,
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            "A few English keywords, e.g. 'population municipality' or 'consumer price index'",
          ),
      }),
      execute: async ({ query }, { abortSignal }) => {
        const tables = await client.searchTables(query, {
          pageSize: SEARCH_PAGE_SIZE,
          signal: abortSignal,
        });
        return { tables: tables.map(summarizeTable) };
      },
    }),

    getTableMetadata: tool({
      description:
        'Get a table\'s dimensions and value codes. Always call this before queryTable: queries must use the codes it returns. Dimensions with many values (like regions) only show examples; pass "search" with names to find their codes.',
      inputSchema: z.object({
        tableId: z.string().describe("Table id from searchTables"),
        search: z
          .array(z.string().min(1))
          .optional()
          .describe("Value names to look up, e.g. ['Oslo', 'Bergen']"),
      }),
      execute: async ({ tableId, search }, { abortSignal }) =>
        summarizeMetadata(await getMetadata(tableId, abortSignal), search),
    }),

    queryTable: tool({
      description: `Fetch numbers from a table. Select value codes per dimension; leave out optional dimensions to get totals. Keep it small: at most ${MAX_QUERY_CELLS} cells. Cite the returned tableId and tableUrl in your answer.`,
      inputSchema: z.object({
        tableId: z.string().describe("Table id from searchTables"),
        selection: z.array(
          z.object({
            dimension: z.string().describe("Dimension code, e.g. 'Region'"),
            values: z
              .array(z.string())
              .min(1)
              .optional()
              .describe("Value codes, e.g. ['0301']"),
            latest: z
              .number()
              .int()
              .min(1)
              .optional()
              .describe(
                "Instead of values: the N most recent periods (time dimension only)",
              ),
          }),
        ),
      }),
      execute: async ({ tableId, selection }, { abortSignal }) => {
        const meta = await getMetadata(tableId, abortSignal);
        const result = await client.queryTable(
          tableId,
          buildSelection(meta, selection),
          { metadata: meta, signal: abortSignal },
        );
        return summarizeResult(result);
      },
    }),
  };
}

export type PxTools = ReturnType<typeof createPxTools>;
