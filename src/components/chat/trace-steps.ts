import { toolLabel, type ToolPart } from "./tool-label";

export type StepStatus = "running" | "done" | "error";

export interface StepDetails {
  lines: string[];
  link?: { href: string; label: string };
}

export function stepStatus(part: ToolPart): StepStatus {
  if (part.state === "output-error") return "error";
  return part.state === "output-available" ? "done" : "running";
}

export function stepDetails(part: ToolPart): StepDetails {
  if (part.state === "output-error") return { lines: [part.errorText] };
  if (part.state !== "output-available") return { lines: [] };

  switch (part.type) {
    case "tool-searchTables":
      return {
        lines: part.output.tables.map(
          (t) => `${t.id}: ${t.title} (${t.period})`,
        ),
      };
    case "tool-getTableMetadata":
      return {
        lines: part.output.dimensions.map(
          (d) => `${d.label}: ${d.valueCount} values`,
        ),
      };
    case "tool-queryTable":
      return {
        lines: part.input.selection.map(
          (s) =>
            `${s.dimension}: ${s.values?.join(", ") ?? `latest ${s.latest}`}`,
        ),
        link: { href: part.output.sourceUrl, label: "Raw API response" },
      };
    case "tool-showVisual":
      return { lines: [] };
  }
}

export function traceSummary(parts: ToolPart[]) {
  const running = parts.findLast((p) => stepStatus(p) === "running");
  if (running) return `${toolLabel(running)}…`;

  const steps = `${parts.length} ${parts.length === 1 ? "step" : "steps"}`;
  const tables = [
    ...new Set(
      parts.flatMap((p) =>
        p.type === "tool-queryTable" && p.state === "output-available"
          ? [p.output.tableId]
          : [],
      ),
    ),
  ];
  if (tables.length === 0) return steps;
  const noun = tables.length === 1 ? "table" : "tables";
  return `${steps} · data from ${noun} ${tables.join(", ")}`;
}
