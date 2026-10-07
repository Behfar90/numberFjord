import type { AgentUIMessage } from "@/lib/agent/agent";

type Part = AgentUIMessage["parts"][number];
export type ToolPart = Extract<
  Part,
  { type: "tool-searchTables" | "tool-getTableMetadata" | "tool-queryTable" }
>;

export function isToolPart(part: Part): part is ToolPart {
  return (
    part.type === "tool-searchTables" ||
    part.type === "tool-getTableMetadata" ||
    part.type === "tool-queryTable"
  );
}

export function toolLabel(part: ToolPart): string {
  const input = part.input;
  switch (part.type) {
    case "tool-searchTables": {
      const query = input && "query" in input ? input.query : undefined;
      if (part.state === "output-available") {
        return `Searched for "${query}": ${part.output.tables.length} tables`;
      }
      return query ? `Searching for "${query}"` : "Searching tables";
    }
    case "tool-getTableMetadata": {
      const id = input && "tableId" in input ? input.tableId : undefined;
      return part.state === "output-available"
        ? `Read table ${id}: ${part.output.title}`
        : `Reading table ${id ?? ""}`.trim();
    }
    case "tool-queryTable": {
      const id = input && "tableId" in input ? input.tableId : undefined;
      return part.state === "output-available"
        ? `Fetched ${part.output.rows.length} rows from table ${id}`
        : `Querying table ${id ?? ""}`.trim();
    }
  }
}
