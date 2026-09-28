import { z } from "zod";

// Zod schemas for the parts of SSB PxWebApi v2 responses we rely on.
// Objects are non-strict: unknown keys are stripped, so new API fields don't break us.

// --- GET /tables (search) ---

export const tableSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  updated: z.iso.datetime(),
  firstPeriod: z.string(),
  lastPeriod: z.string(),
  variableNames: z.array(z.string()),
  timeUnit: z.string(),
  subjectCode: z.string(),
});

export const tableSearchResponseSchema = z.object({
  language: z.string(),
  tables: z.array(tableSummarySchema),
  page: z.object({
    pageNumber: z.number().int(),
    pageSize: z.number().int(),
    totalElements: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export type TableSummary = z.infer<typeof tableSummarySchema>;
export type TableSearchResponse = z.infer<typeof tableSearchResponseSchema>;

// --- JSON-stat2 dataset (GET /tables/{id}/metadata and /tables/{id}/data) ---

const codelistSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
});

const dimensionSchema = z.object({
  label: z.string(),
  category: z.object({
    // JSON-stat also allows an array here, but SSB always sends code → position.
    index: z.record(z.string(), z.number().int().nonnegative()),
    label: z.record(z.string(), z.string()),
    unit: z
      .record(
        z.string(),
        z.object({ base: z.string(), decimals: z.number().int() }),
      )
      .optional(),
  }),
  extension: z
    .object({
      // Whether the dimension may be left out of a query (SSB then aggregates it).
      elimination: z.boolean().optional(),
      codelists: z.array(codelistSchema).optional(),
    })
    .optional(),
});

export const jsonStatDatasetSchema = z
  .object({
    version: z.literal("2.0"),
    class: z.literal("dataset"),
    label: z.string(),
    source: z.string(),
    updated: z.iso.datetime(),
    note: z.array(z.string()).optional(),
    id: z.array(z.string()),
    size: z.array(z.number().int().nonnegative()),
    role: z
      .object({
        time: z.array(z.string()).optional(),
        geo: z.array(z.string()).optional(),
        metric: z.array(z.string()).optional(),
      })
      .optional(),
    dimension: z.record(z.string(), dimensionSchema),
    // Metadata responses send an empty array; missing cells are null.
    value: z.array(z.number().nullable()),
    // Cell index → symbol (e.g. ".." not available), only present when needed.
    status: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((ds, ctx) => {
    if (ds.id.length !== ds.size.length) {
      ctx.addIssue({
        code: "custom",
        message: "id and size must have the same length",
      });
    }
    for (const dim of ds.id) {
      if (!(dim in ds.dimension)) {
        ctx.addIssue({ code: "custom", message: `missing dimension ${dim}` });
      }
    }
    const cells = ds.size.reduce((a, b) => a * b, 1);
    if (ds.value.length > 0 && ds.value.length !== cells) {
      ctx.addIssue({
        code: "custom",
        message: `expected ${cells} values, got ${ds.value.length}`,
      });
    }
  });

export type JsonStatDataset = z.infer<typeof jsonStatDatasetSchema>;
export type JsonStatDimension = z.infer<typeof dimensionSchema>;

// --- Errors (problem+json) ---

export const problemSchema = z.object({
  type: z.string().optional(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
});

export type Problem = z.infer<typeof problemSchema>;
