import { describe, expect, it } from "vitest";

import type { ToolPart } from "./tool-label";
import { stepDetails, stepStatus, traceSummary } from "./trace-steps";

// Outputs are trimmed to the fields the trace reads.
function part(fields: object) {
  return { toolCallId: "call-1", ...fields } as ToolPart;
}

const search = part({
  type: "tool-searchTables",
  state: "output-available",
  input: { query: "population" },
  output: {
    tables: [
      { id: "05212", title: "Population, by region", period: "1990–2026" },
    ],
  },
});

const query = part({
  type: "tool-queryTable",
  state: "output-available",
  input: {
    tableId: "05212",
    selection: [
      { dimension: "Region", values: ["0301", "4601"] },
      { dimension: "Tid", latest: 5 },
    ],
  },
  output: {
    tableId: "05212",
    rows: [[], []],
    sourceUrl: "https://data.ssb.no/api/pxwebapi/v2/tables/05212/data?x=1",
  },
});

const failed = part({
  type: "tool-queryTable",
  state: "output-error",
  input: { tableId: "05212", selection: [] },
  errorText: "Unknown value codes for Region: Oslo.",
});

describe("stepStatus", () => {
  it("maps tool states to running, done and error", () => {
    expect(
      stepStatus(part({ type: "tool-searchTables", state: "input-streaming" })),
    ).toBe("running");
    expect(stepStatus(search)).toBe("done");
    expect(stepStatus(failed)).toBe("error");
  });
});

describe("stepDetails", () => {
  it("lists the tables a search found", () => {
    expect(stepDetails(search)).toEqual({
      lines: ["05212: Population, by region (1990–2026)"],
    });
  });

  it("shows a query's selection and links to the raw API response", () => {
    expect(stepDetails(query)).toEqual({
      lines: ["Region: 0301, 4601", "Tid: latest 5"],
      link: {
        href: "https://data.ssb.no/api/pxwebapi/v2/tables/05212/data?x=1",
        label: "Raw API response",
      },
    });
  });

  it("shows the error the model saw", () => {
    expect(stepDetails(failed)).toEqual({
      lines: ["Unknown value codes for Region: Oslo."],
    });
  });
});

describe("traceSummary", () => {
  it("shows the step that is still running", () => {
    const running = part({
      type: "tool-queryTable",
      state: "input-available",
      input: { tableId: "05212", selection: [] },
    });
    expect(traceSummary([search, running])).toBe("Querying table 05212…");
  });

  it("counts steps and names the tables data came from", () => {
    expect(traceSummary([search, failed, query])).toBe(
      "3 steps · data from table 05212",
    );
  });

  it("leaves out tables when nothing was queried", () => {
    expect(traceSummary([search])).toBe("1 step");
  });
});
