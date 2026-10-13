import type { Tool } from "ai";
import { describe, expect, it, vi } from "vitest";

import { createPxClient, SSB_CONFIG, type TableMetadata } from "@/lib/ssb";
import data from "@/lib/ssb/__fixtures__/data-07459-oslo.json";
import metadata from "@/lib/ssb/__fixtures__/metadata-07459.json";
import search from "@/lib/ssb/__fixtures__/search-population.json";

import {
  buildSelection,
  createPxTools,
  MAX_QUERY_CELLS,
  summarizeMetadata,
} from "./tools";

function routedFetch() {
  return vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input)).pathname;
    const body = path.endsWith("/metadata")
      ? metadata
      : path.endsWith("/data")
        ? data
        : search;
    return new Response(JSON.stringify(body));
  });
}

function setup() {
  const fetch = routedFetch();
  const tools = createPxTools(createPxClient({ ...SSB_CONFIG, fetch }));
  return { fetch, tools };
}

// Our tools return a plain promise, never a stream of results.
async function run<INPUT, OUTPUT>(
  tool: Tool<INPUT, OUTPUT>,
  input: INPUT,
): Promise<OUTPUT> {
  const options = { toolCallId: "call-1", messages: [], context: {} };
  return (await tool.execute!(input, options)) as OUTPUT;
}

async function loadMetadata(): Promise<TableMetadata> {
  const client = createPxClient({ ...SSB_CONFIG, fetch: routedFetch() });
  return client.getTableMetadata("07459");
}

describe("searchTables tool", () => {
  it("returns compact table summaries", async () => {
    const { tools } = setup();
    const { tables } = await run(tools.searchTables, { query: "population" });

    expect(tables[0]).toEqual({
      id: "05212",
      title:
        "Population in densely and sparsely populated areas, by sex (M) 1990-2026",
      period: "1990–2026",
      frequency: "Annual",
      updated: "2026-08-31",
      variables: [
        "region",
        "densely/sparsely populated areas",
        "sex",
        "contents",
        "year",
      ],
    });
  });
});

describe("summarizeMetadata", () => {
  it("lists small dimensions in full and marks required ones", async () => {
    const summary = summarizeMetadata(await loadMetadata());
    const sex = summary.dimensions.find((d) => d.code === "Kjonn");

    expect(sex).toMatchObject({
      required: false,
      valueCount: 2,
      values: [
        { code: "2", label: "Females" },
        { code: "1", label: "Males" },
      ],
    });
  });

  it("shows the time dimension as a range", async () => {
    const summary = summarizeMetadata(await loadMetadata());

    expect(summary.dimensions.find((d) => d.code === "Tid")).toMatchObject({
      required: true,
      isTime: true,
      valueCount: 41,
      first: "1986",
      last: "2026",
    });
  });

  it("shows only examples for large dimensions, with a hint", async () => {
    const summary = summarizeMetadata(await loadMetadata());
    const region = summary.dimensions.find((d) => d.code === "Region");

    expect(region).toMatchObject({ valueCount: 994 });
    expect(region && "examples" in region && region.examples).toHaveLength(10);
    expect(summary.hint).toBeDefined();
  });

  it("finds value codes in large dimensions by search term", async () => {
    const summary = summarizeMetadata(await loadMetadata(), ["oslo"]);
    const region = summary.dimensions.find((d) => d.code === "Region");

    expect(region && "matches" in region && region.matches).toContainEqual({
      code: "0301",
      label: "Oslo - Oslove",
    });
  });
});

describe("buildSelection", () => {
  it("converts input to a selection and fills single-value required dimensions", async () => {
    const selection = buildSelection(await loadMetadata(), [
      { dimension: "Region", values: ["0301"] },
      { dimension: "Tid", latest: 2 },
    ]);

    expect(selection).toEqual({
      Region: ["0301"],
      Tid: { top: 2 },
      ContentsCode: ["Personer1"],
    });
  });

  it.each([
    [[{ dimension: "Fylke", values: ["03"] }], /no dimension "Fylke"/],
    [
      [{ dimension: "Region", values: ["Oslo"] }],
      /Unknown value codes for Region: Oslo/,
    ],
    [
      [{ dimension: "Region", latest: 1 }],
      /only works on the time dimension \(Tid\)/,
    ],
    [[{ dimension: "Region" }], /either "values" or "latest"/],
    [[{ dimension: "Region", values: ["0301"] }], /Tid \(year\) is required/],
  ])("rejects invalid input %#", async (input, message) => {
    const meta = await loadMetadata();
    expect(() => buildSelection(meta, input)).toThrow(message);
  });

  it("rejects selections over the cell limit", async () => {
    const meta = await loadMetadata();
    const ages = meta.dimensions.find((d) => d.code === "Alder")!.values;

    expect(() =>
      buildSelection(meta, [
        { dimension: "Alder", values: ages.map((v) => v.code) },
        { dimension: "Kjonn", values: ["1", "2"] },
        { dimension: "Tid", latest: 3 },
      ]),
    ).toThrow(`over the limit of ${MAX_QUERY_CELLS}`);
  });
});

describe("queryTable tool", () => {
  const input = {
    tableId: "07459",
    selection: [
      { dimension: "Region", values: ["0301"] },
      { dimension: "Kjonn", values: ["1", "2"] },
      { dimension: "Tid", latest: 2 },
    ],
  };

  it("returns rows with single-value dimensions moved to fixed", async () => {
    const { tools } = setup();
    const result = await run(tools.queryTable, input);

    expect(result).toMatchObject({
      tableId: "07459",
      tableUrl: "https://www.ssb.no/en/statbank/table/07459",
      fixed: { region: "Oslo - Oslove", contents: "Persons" },
      columns: ["sex", "age", "year", "value"],
    });
    expect(result.rows[0]).toEqual(["Males", "0-19 years", "2025", 74911]);
    expect(result.sourceUrl).toContain("/tables/07459/data");
  });

  it("reuses metadata already fetched for the same table", async () => {
    const { fetch, tools } = setup();
    await run(tools.getTableMetadata, { tableId: "07459" });
    await run(tools.queryTable, input);

    const paths = fetch.mock.calls.map(
      ([url]) => new URL(String(url)).pathname,
    );
    expect(paths.filter((p) => p.endsWith("/metadata"))).toHaveLength(1);
  });

  it("does not call the data endpoint when the selection is invalid", async () => {
    const { fetch, tools } = setup();
    await expect(
      run(tools.queryTable, {
        tableId: "07459",
        selection: [{ dimension: "Region", values: ["Oslo"] }],
      }),
    ).rejects.toThrow(/Unknown value codes/);

    const paths = fetch.mock.calls.map(
      ([url]) => new URL(String(url)).pathname,
    );
    expect(paths.some((p) => p.endsWith("/data"))).toBe(false);
  });
});
