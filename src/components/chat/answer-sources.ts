import { toSource } from "@/lib/charts/build";
import type { Source } from "@/lib/charts/schema";

import type { ToolPart } from "./tool-label";

// Built from query results, so an answer is cited even when the model forgets to.
export function answerSources(parts: ToolPart[]): Source[] {
  const sources = new Map<string, Source>();
  for (const part of parts) {
    if (part.type === "tool-queryTable" && part.state === "output-available") {
      sources.set(part.output.tableId, toSource(part.output));
    }
  }
  return [...sources.values()];
}
