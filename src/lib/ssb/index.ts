export {
  MAX_CELLS,
  estimateCells,
  getTableMetadata,
  queryTable,
  searchTables,
  tableUrl,
  type Dimension,
  type DimensionSelection,
  type DimensionValue,
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
export type { Lang, SsbFetchOptions } from "./http";
export type { JsonStatDataset, TableSummary } from "./schemas";
