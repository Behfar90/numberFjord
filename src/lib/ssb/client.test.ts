import { describe, expect, it, vi } from "vitest";

import data from "./__fixtures__/data-07459-oslo.json";
import errorTooManyCells from "./__fixtures__/error-too-many-cells.json";
import metadata from "./__fixtures__/metadata-07459.json";
import search from "./__fixtures__/search-population.json";
import {
  estimateCells,
  getTableMetadata,
  queryTable,
  searchTables,
  tableUrl,
  toQueryParams,
  type TableMetadata,
} from "./client";
import { SsbInvalidQueryError, SsbTooLargeError } from "./errors";

function fakeFetch(body: unknown, status = 200) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

const requestedUrl = (fetch: ReturnType<typeof fakeFetch>) =>
  decodeURIComponent(String(fetch.mock.calls[0][0]));

async function loadMetadata(): Promise<TableMetadata> {
  return getTableMetadata("07459", { fetch: fakeFetch(metadata) });
}

describe("searchTables", () => {
  it("queries /tables and returns the table summaries", async () => {
    const fetch = fakeFetch(search);
    const tables = await searchTables("population", { pageSize: 5, fetch });

    expect(requestedUrl(fetch)).toBe(
      "https://data.ssb.no/api/pxwebapi/v2/tables?lang=en&query=population&pageSize=5",
    );
    expect(tables.map((t) => t.id)).toContain("05212");
  });
});

describe("getTableMetadata", () => {
  it("returns dimensions in table order and values in index order", async () => {
    const meta = await loadMetadata();

    expect(meta.dimensions.map((d) => d.code)).toEqual([
      "Region",
      "Kjonn",
      "Alder",
      "ContentsCode",
      "Tid",
    ]);
    // SSB's metadata puts Females at index 0, despite key order "1", "2".
    const sex = meta.dimensions[1];
    expect(sex.values).toEqual([
      { code: "2", label: "Females" },
      { code: "1", label: "Males" },
    ]);
    expect(meta.dimensions[0].values).toHaveLength(994);
  });

  it("exposes elimination, codelists and time/geo roles", async () => {
    const meta = await loadMetadata();
    const [region, , age, contents] = meta.dimensions;

    expect(region.elimination).toBe(true);
    expect(contents.elimination).toBe(false);
    expect(age.codelists).toContainEqual({
      id: "agg_TredeltGrupperingB2",
      label: "Tripartite (0-19, 20-64, 65+)",
    });
    expect(meta.timeDimension).toBe("Tid");
    expect(meta.geoDimension).toBe("Region");
    expect(meta.tableUrl).toBe("https://www.ssb.no/en/statbank/table/07459");
  });

  it("rejects a malformed table id without calling SSB", async () => {
    const fetch = fakeFetch(metadata);
    await expect(
      getTableMetadata("../07459", { fetch }),
    ).rejects.toBeInstanceOf(SsbInvalidQueryError);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("queryTable", () => {
  it("builds the data url and returns the dataset with source links", async () => {
    const fetch = fakeFetch(data);
    const result = await queryTable(
      "07459",
      {
        Region: ["0301"],
        Kjonn: ["1", "2"],
        Alder: "*",
        ContentsCode: ["Personer1"],
        Tid: { top: 2 },
      },
      { codelists: { Alder: "agg_TredeltGrupperingB2" }, fetch },
    );

    expect(requestedUrl(fetch)).toBe(
      "https://data.ssb.no/api/pxwebapi/v2/tables/07459/data?lang=en" +
        "&valueCodes[Region]=0301&valueCodes[Kjonn]=1,2&valueCodes[Alder]=*" +
        "&valueCodes[ContentsCode]=Personer1&valueCodes[Tid]=top(2)" +
        "&codelist[Alder]=agg_TredeltGrupperingB2",
    );
    expect(result.dataset.value).toHaveLength(12);
    expect(result.sourceUrl).toBe(String(fetch.mock.calls[0][0]));
    expect(result.tableUrl).toBe("https://www.ssb.no/en/statbank/table/07459");
  });

  it("refuses a selection over 800,000 cells before calling SSB", async () => {
    const meta = await loadMetadata();
    const fetch = fakeFetch(data);
    const everything = Object.fromEntries(
      meta.dimensions.map((d) => [d.code, "*" as const]),
    );

    await expect(
      queryTable("07459", everything, { metadata: meta, fetch }),
    ).rejects.toBeInstanceOf(SsbTooLargeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to SSB's own 'too many cells' error without metadata", async () => {
    const fetch = fakeFetch(errorTooManyCells.body, errorTooManyCells.status);
    await expect(
      queryTable("07459", { Region: "*", Tid: "*" }, { fetch }),
    ).rejects.toBeInstanceOf(SsbTooLargeError);
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("toQueryParams", () => {
  it("encodes lists, wildcards, top(n) and codelists", () => {
    expect(
      toQueryParams(
        { Region: ["0301", "4601"], Alder: "*", Tid: { top: 3 } },
        { Region: "agg_Fylker2024" },
      ),
    ).toEqual({
      "valueCodes[Region]": "0301,4601",
      "valueCodes[Alder]": "*",
      "valueCodes[Tid]": "top(3)",
      "codelist[Region]": "agg_Fylker2024",
    });
  });
});

describe("estimateCells", () => {
  it("multiplies the selected counts", () => {
    expect(estimateCells({ Kjonn: ["1", "2"], Tid: { top: 5 } })).toBe(10);
  });

  it("resolves '*' from metadata", async () => {
    const meta = await loadMetadata();
    expect(estimateCells({ Region: "*", Kjonn: ["1"] }, meta)).toBe(994);
  });

  it("is undefined when '*' can't be resolved", () => {
    expect(estimateCells({ Region: "*" })).toBeUndefined();
  });
});

describe("tableUrl", () => {
  it("links to the English or Norwegian StatBank page", () => {
    expect(tableUrl("07459")).toBe(
      "https://www.ssb.no/en/statbank/table/07459",
    );
    expect(tableUrl("07459", "no")).toBe(
      "https://www.ssb.no/statbank/table/07459",
    );
  });
});
