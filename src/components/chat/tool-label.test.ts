import { describe, expect, it } from "vitest";

import { toolLabel, type ToolPart } from "./tool-label";

// Outputs are trimmed to the fields the labels read.
function part(fields: object) {
  return { toolCallId: "call-1", ...fields } as ToolPart;
}

describe("toolLabel", () => {
  it("shows a search while its input is still streaming", () => {
    expect(
      toolLabel(
        part({
          type: "tool-searchTables",
          state: "input-streaming",
          input: undefined,
        }),
      ),
    ).toBe("Searching tables");
  });

  it("shows the query and number of tables found", () => {
    const input = { query: "population" };
    expect(
      toolLabel(
        part({ type: "tool-searchTables", state: "input-available", input }),
      ),
    ).toBe('Searching for "population"');
    expect(
      toolLabel(
        part({
          type: "tool-searchTables",
          state: "output-available",
          input,
          output: { tables: [{}, {}, {}] },
        }),
      ),
    ).toBe('Searched for "population": 3 tables');
  });

  it("shows the table title once metadata is read", () => {
    expect(
      toolLabel(
        part({
          type: "tool-getTableMetadata",
          state: "output-available",
          input: { tableId: "11342" },
          output: { title: "Population and area" },
        }),
      ),
    ).toBe("Read table 11342: Population and area");
  });

  it("shows how many rows a query returned", () => {
    const input = { tableId: "11342", selection: [] };
    expect(
      toolLabel(
        part({ type: "tool-queryTable", state: "input-available", input }),
      ),
    ).toBe("Querying table 11342");
    expect(
      toolLabel(
        part({
          type: "tool-queryTable",
          state: "output-available",
          input,
          output: { rows: [[], [], []] },
        }),
      ),
    ).toBe("Fetched 3 rows from table 11342");
  });

  it("names the chart or table once it is drawn", () => {
    const input = { resultId: "call-1", visual: { kind: "chart" } };
    expect(
      toolLabel(
        part({ type: "tool-showVisual", state: "input-available", input }),
      ),
    ).toBe("Drawing");
    expect(
      toolLabel(
        part({
          type: "tool-showVisual",
          state: "output-available",
          input,
          output: { kind: "chart", chartType: "line", title: "Oslo" },
        }),
      ),
    ).toBe("Drew line chart: Oslo");
    expect(
      toolLabel(
        part({
          type: "tool-showVisual",
          state: "output-available",
          input,
          output: { kind: "table", title: "Oslo" },
        }),
      ),
    ).toBe("Made table: Oslo");
  });

  it("keeps the running label when a call failed", () => {
    expect(
      toolLabel(
        part({
          type: "tool-queryTable",
          state: "output-error",
          input: { tableId: "11342", selection: [] },
          errorText: "Unknown value codes",
        }),
      ),
    ).toBe("Querying table 11342");
  });
});
