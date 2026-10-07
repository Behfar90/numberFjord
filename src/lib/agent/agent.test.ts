import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { createPxClient, SSB_CONFIG } from "@/lib/ssb";
import data from "@/lib/ssb/__fixtures__/data-07459-oslo.json";
import metadata from "@/lib/ssb/__fixtures__/metadata-07459.json";
import search from "@/lib/ssb/__fixtures__/search-population.json";

import { createAgent, MAX_STEPS } from "./agent";

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function toolCall(toolName: string, input: object) {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId: `call-${toolName}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage,
    warnings: [],
  };
}

function text(answer: string) {
  return {
    content: [{ type: "text" as const, text: answer }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage,
    warnings: [],
  };
}

function setup(model: MockLanguageModelV4) {
  const fakeFetch = vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input)).pathname;
    const body = path.endsWith("/metadata")
      ? metadata
      : path.endsWith("/data")
        ? data
        : search;
    return new Response(JSON.stringify(body));
  });
  const agent = createAgent({
    model,
    client: createPxClient({ ...SSB_CONFIG, fetch: fakeFetch }),
  });
  const paths = () =>
    fakeFetch.mock.calls.map(([url]) => new URL(String(url)).pathname);
  return { agent, paths };
}

const osloQuery = {
  tableId: "07459",
  selection: [
    { dimension: "Region", values: ["0301"] },
    { dimension: "Tid", latest: 1 },
  ],
};

describe("createAgent", () => {
  it("runs search, metadata and query before answering", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCall("searchTables", { query: "population" }),
        toolCall("getTableMetadata", { tableId: "07459", search: ["Oslo"] }),
        toolCall("queryTable", osloQuery),
        text("Oslo had 717,710 residents (table 07459)."),
      ],
    });
    const { agent, paths } = setup(model);

    const result = await agent.generate({ prompt: "Population of Oslo?" });

    expect(result.text).toContain("table 07459");
    expect(result.steps.map((s) => s.toolCalls[0]?.toolName)).toEqual([
      "searchTables",
      "getTableMetadata",
      "queryTable",
      undefined,
    ]);
    expect(paths().map((p) => p.split("/").at(-1))).toEqual([
      "tables",
      "metadata",
      "data",
    ]);
  });

  it("sends tool errors back to the model so it can retry", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCall("queryTable", {
          tableId: "07459",
          selection: [{ dimension: "Region", values: ["Oslo"] }],
        }),
        toolCall("queryTable", osloQuery),
        text("Done."),
      ],
    });
    const { agent } = setup(model);

    const result = await agent.generate({ prompt: "Population of Oslo?" });

    const secondPrompt = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(secondPrompt).toContain("Unknown value codes for Region: Oslo");
    expect(result.text).toBe("Done.");
  });

  it(`stops after ${MAX_STEPS} steps`, async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => toolCall("searchTables", { query: "people" }),
    });
    const { agent } = setup(model);

    const result = await agent.generate({ prompt: "Loop forever" });

    expect(model.doGenerateCalls).toHaveLength(MAX_STEPS);
    expect(result.steps).toHaveLength(MAX_STEPS);
  });
});
