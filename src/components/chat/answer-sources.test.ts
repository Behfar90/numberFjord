import { describe, expect, it } from "vitest";

import { answerSources } from "./answer-sources";
import type { ToolPart } from "./tool-label";

// Outputs are trimmed to the fields the sources read.
function part(fields: object) {
  return fields as ToolPart;
}

function query(tableId: string, state = "output-available") {
  return part({
    toolCallId: `call-${tableId}`,
    type: "tool-queryTable",
    state,
    input: { tableId, selection: [] },
    output: {
      tableId,
      title: `Table ${tableId}`,
      source: "Statistics Norway",
      updated: "2026-08-31",
      tableUrl: `https://www.ssb.no/en/statbank/table/${tableId}`,
    },
  });
}

describe("answerSources", () => {
  it("lists each queried table once, in query order", () => {
    const sources = answerSources([
      query("05212"),
      query("07459"),
      query("05212"),
    ]);

    expect(sources.map((s) => s.tableId)).toEqual(["05212", "07459"]);
    expect(sources[0]).toEqual({
      name: "Statistics Norway",
      tableId: "05212",
      tableTitle: "Table 05212",
      tableUrl: "https://www.ssb.no/en/statbank/table/05212",
      updated: "2026-08-31",
      license: "CC BY 4.0",
    });
  });

  it("ignores searches and queries that failed", () => {
    const search = part({
      toolCallId: "call-search",
      type: "tool-searchTables",
      state: "output-available",
      input: { query: "population" },
      output: { tables: [] },
    });

    expect(answerSources([search, query("05212", "output-error")])).toEqual([]);
  });
});
