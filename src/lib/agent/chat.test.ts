import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { createPxClient, SSB_CONFIG } from "@/lib/ssb";

import { createAgent } from "./agent";
import { handleChat, MAX_MESSAGES } from "./chat";

function setup() {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Hei!" },
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 3,
                noCache: 3,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
  const fetch = vi.fn<typeof globalThis.fetch>();
  const agent = createAgent({
    model,
    client: createPxClient({ ...SSB_CONFIG, fetch }),
  });
  return { agent, model };
}

function userMessage(text: string, id = "m1") {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function post(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("handleChat", () => {
  it("streams the agent's answer as a UI message stream", async () => {
    const { agent, model } = setup();

    const response = await handleChat(
      post({ messages: [userMessage("Hello")] }),
      agent,
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain("Hei!");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("Hello");
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["no messages", { messages: [] }],
    [
      "too many messages",
      {
        messages: Array.from({ length: MAX_MESSAGES + 1 }, (_, i) =>
          userMessage("hi", `m${i}`),
        ),
      },
    ],
  ])("rejects %s with 400 without calling the model", async (_, body) => {
    const { agent, model } = setup();

    const response = await handleChat(post(body), agent);

    expect(response.status).toBe(400);
    expect(model.doStreamCalls).toHaveLength(0);
  });
});
