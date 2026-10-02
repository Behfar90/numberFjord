import { createPxClient, type PxConfig } from "./client";

export const SSB_CONFIG: PxConfig = {
  baseUrl: "https://data.ssb.no/api/pxwebapi/v2",
  lang: "en",
  sourceName: "Statistics Norway",
  maxCells: 800_000,
  tableIdPattern: /^\d{5}$/,
  tableUrl: (tableId, lang) =>
    `https://www.ssb.no${lang === "en" ? "/en" : ""}/statbank/table/${tableId}`,
};

export const ssb = createPxClient(SSB_CONFIG);

export {
  createPxClient,
  estimateCells,
  type Dimension,
  type DimensionSelection,
  type DimensionValue,
  type PxClient,
  type PxConfig,
  type QueryOptions,
  type QueryResult,
  type Selection,
  type TableMetadata,
} from "./client";
export {
  SsbError,
  SsbInvalidQueryError,
  SsbNotFoundError,
  SsbRateLimitError,
  SsbTooLargeError,
  SsbUnavailableError,
} from "./errors";
export type { RequestOptions } from "./http";
export type { JsonStatDataset, TableSummary } from "./schemas";
