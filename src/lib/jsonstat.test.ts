import { describe, expect, it } from "vitest";

import { toRows } from "./jsonstat";
import data from "./ssb/__fixtures__/data-07459-oslo.json";
import { jsonStatDatasetSchema } from "./ssb/schemas";

const dataset = jsonStatDatasetSchema.parse(data);

describe("toRows", () => {
  it("returns one row per value, labelled by every dimension", () => {
    const rows = toRows(dataset);

    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      labels: {
        Region: "Oslo - Oslove",
        Kjonn: "Males",
        Alder: "0-19 years",
        ContentsCode: "Persons",
        Tid: "2025",
      },
      value: 74911,
    });
  });

  it("varies the last dimension fastest", () => {
    const rows = toRows(dataset);

    expect(rows.slice(0, 3).map((r) => [r.labels.Alder, r.labels.Tid])).toEqual(
      [
        ["0-19 years", "2025"],
        ["0-19 years", "2026"],
        ["20-64 years", "2025"],
      ],
    );
    expect(rows[11].labels).toMatchObject({
      Kjonn: "Females",
      Alder: "65 years or older",
      Tid: "2026",
    });
  });

  it("keeps missing values as null", () => {
    const rows = toRows({ ...dataset, value: dataset.value.map(() => null) });

    expect(rows.every((r) => r.value === null)).toBe(true);
  });
});
