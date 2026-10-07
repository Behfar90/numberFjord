import { describe, expect, it } from "vitest";

import { createPxClient, SSB_CONFIG } from "@/lib/ssb";

import { systemPrompt } from "./instructions";
import { createPxTools } from "./tools";

describe("systemPrompt", () => {
  it("includes today's date so the model can resolve 'last year'", () => {
    expect(systemPrompt(new Date("2026-10-07T12:00:00Z"))).toContain(
      "Today is 2026-10-07.",
    );
  });

  it("names every tool, so a renamed tool fails here", () => {
    const tools = createPxTools(createPxClient(SSB_CONFIG));
    const prompt = systemPrompt();

    for (const name of Object.keys(tools)) {
      expect(prompt).toContain(name);
    }
  });
});
