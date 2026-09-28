import { SsbInvalidQueryError, SsbTooLargeError } from "./errors";
import { ssbFetch, type Lang, type SsbFetchOptions } from "./http";
import {
  jsonStatDatasetSchema,
  tableSearchResponseSchema,
  type JsonStatDataset,
  type JsonStatDimension,
  type TableSummary,
} from "./schemas";

export const MAX_CELLS = 800_000;

export interface DimensionValue {
  code: string;
  label: string;
}

export interface Dimension {
  code: string;
  label: string;
  elimination: boolean;
  values: DimensionValue[];
  codelists: { id: string; label: string }[];
}

export interface TableMetadata {
  id: string;
  label: string;
  updated: string;
  dimensions: Dimension[];
  timeDimension: string | undefined;
  geoDimension: string | undefined;
  tableUrl: string;
}

export type DimensionSelection = string[] | "*" | { top: number };
export type Selection = Record<string, DimensionSelection>;

export interface QueryOptions extends SsbFetchOptions {
  codelists?: Record<string, string>;
  // Lets the cell-count check resolve "*" to a real count.
  metadata?: TableMetadata;
}

export interface QueryResult {
  tableId: string;
  dataset: JsonStatDataset;
  sourceUrl: string;
  tableUrl: string;
}

export async function searchTables(
  query: string,
  { pageSize = 10, ...options }: SsbFetchOptions & { pageSize?: number } = {},
): Promise<TableSummary[]> {
  const { data } = await ssbFetch(
    "/tables",
    { query, pageSize: String(pageSize) },
    tableSearchResponseSchema,
    options,
  );
  return data.tables;
}

export async function getTableMetadata(
  tableId: string,
  options: SsbFetchOptions = {},
): Promise<TableMetadata> {
  assertTableId(tableId);
  const { data } = await ssbFetch(
    `/tables/${tableId}/metadata`,
    {},
    jsonStatDatasetSchema,
    options,
  );
  return {
    id: tableId,
    label: data.label,
    updated: data.updated,
    dimensions: data.id.map((code) => toDimension(code, data.dimension[code])),
    timeDimension: data.role?.time?.[0],
    geoDimension: data.role?.geo?.[0],
    tableUrl: tableUrl(tableId, options.lang),
  };
}

export async function queryTable(
  tableId: string,
  selection: Selection,
  { codelists = {}, metadata, ...options }: QueryOptions = {},
): Promise<QueryResult> {
  assertTableId(tableId);

  const cells = estimateCells(selection, metadata);
  if (cells !== undefined && cells > MAX_CELLS) {
    throw new SsbTooLargeError(
      `Selection on table ${tableId} is about ${cells} cells, over the ${MAX_CELLS} limit`,
    );
  }

  const { data, url } = await ssbFetch(
    `/tables/${tableId}/data`,
    toQueryParams(selection, codelists),
    jsonStatDatasetSchema,
    options,
  );
  return {
    tableId,
    dataset: data,
    sourceUrl: url,
    tableUrl: tableUrl(tableId, options.lang),
  };
}

export function toQueryParams(
  selection: Selection,
  codelists: Record<string, string> = {},
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [dim, sel] of Object.entries(selection)) {
    params[`valueCodes[${dim}]`] =
      sel === "*"
        ? "*"
        : Array.isArray(sel)
          ? sel.join(",")
          : `top(${sel.top})`;
  }
  for (const [dim, codelist] of Object.entries(codelists)) {
    params[`codelist[${dim}]`] = codelist;
  }
  return params;
}

// Undefined when "*" is used without metadata: the count can't be known,
// so SSB's own 400 "Too many cells" response is the fallback.
export function estimateCells(
  selection: Selection,
  metadata?: TableMetadata,
): number | undefined {
  let cells = 1;
  for (const [dim, sel] of Object.entries(selection)) {
    if (sel === "*") {
      const count = metadata?.dimensions.find((d) => d.code === dim)?.values
        .length;
      if (count === undefined) return undefined;
      cells *= count;
    } else {
      cells *= Array.isArray(sel) ? sel.length : sel.top;
    }
  }
  return cells;
}

export function tableUrl(tableId: string, lang: Lang = "en"): string {
  const prefix = lang === "en" ? "/en" : "";
  return `https://www.ssb.no${prefix}/statbank/table/${tableId}`;
}

function assertTableId(tableId: string): void {
  if (!/^\d{5}$/.test(tableId)) {
    throw new SsbInvalidQueryError(
      `Invalid table id "${tableId}": expected 5 digits`,
    );
  }
}

function toDimension(code: string, dim: JsonStatDimension): Dimension {
  const values = Object.entries(dim.category.index)
    .sort(([, a], [, b]) => a - b)
    .map(([valueCode]) => ({
      code: valueCode,
      label: dim.category.label[valueCode] ?? valueCode,
    }));
  return {
    code,
    label: dim.label,
    elimination: dim.extension?.elimination ?? false,
    values,
    codelists: (dim.extension?.codelists ?? []).map(({ id, label }) => ({
      id,
      label,
    })),
  };
}
