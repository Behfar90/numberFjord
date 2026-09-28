import { describe, expect, it } from "vitest";

import data from "./__fixtures__/data-07459-oslo.json";
import error404 from "./__fixtures__/error-404.json";
import errorTooManyCells from "./__fixtures__/error-too-many-cells.json";
import metadata from "./__fixtures__/metadata-07459.json";
import search from "./__fixtures__/search-population.json";
import {
  jsonStatDatasetSchema,
  problemSchema,
  tableSearchResponseSchema,
} from "./schemas";

describe("tableSearchResponseSchema", () => {
  it("parses a real search response", () => {
    const parsed = tableSearchResponseSchema.parse(search);
    expect(parsed.tables).toHaveLength(5);
    expect(parsed.tables[0]).toMatchObject({ id: "05212", timeUnit: "Annual" });
  });

  it("strips fields we don't use", () => {
    const parsed = tableSearchResponseSchema.parse(search);
    expect(parsed.tables[0]).not.toHaveProperty("links");
  });
});

describe("jsonStatDatasetSchema", () => {
  it("parses real metadata (no values)", () => {
    const parsed = jsonStatDatasetSchema.parse(metadata);
    expect(parsed.value).toEqual([]);
    expect(parsed.id).toEqual([
      "Region",
      "Kjonn",
      "Alder",
      "ContentsCode",
      "Tid",
    ]);
    expect(parsed.dimension.Kjonn.extension?.elimination).toBe(true);
    expect(parsed.role?.time).toEqual(["Tid"]);
  });

  it("parses a real data response", () => {
    const parsed = jsonStatDatasetSchema.parse(data);
    expect(parsed.size).toEqual([1, 2, 3, 1, 2]);
    expect(parsed.value).toHaveLength(12);
    expect(parsed.dimension.Region.category.label["0301"]).toBe(
      "Oslo - Oslove",
    );
  });

  it("rejects a dataset whose value count doesn't match its size", () => {
    const broken = { ...data, value: data.value.slice(1) };
    expect(() => jsonStatDatasetSchema.parse(broken)).toThrow(
      "expected 12 values, got 11",
    );
  });

  it("rejects a dataset that lists a dimension it doesn't describe", () => {
    const broken = { ...data, id: [...data.id.slice(0, -1), "Missing"] };
    expect(() => jsonStatDatasetSchema.parse(broken)).toThrow(
      "missing dimension Missing",
    );
  });
});

describe("problemSchema", () => {
  it.each([
    ["404", error404, "Non-existent table"],
    ["too many cells", errorTooManyCells, "Too many cells selected"],
  ])("parses the %s error body", (_, fixture, title) => {
    const parsed = problemSchema.parse(fixture.body);
    expect(parsed.title).toBe(title);
    expect(parsed.status).toBe(fixture.status);
  });
});
