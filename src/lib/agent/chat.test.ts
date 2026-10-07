import { APICallError, RetryError, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { createPxClient, SSB_CONFIG } from "@/lib/ssb";

import { createAgent } from "./agent";
import {
  chatErrorMessage,
  describeError,
  handleChat,
  MAX_MESSAGES,
} from "./chat";

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

function apiError(statusCode: number, isRetryable?: boolean) {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://ai-gateway.vercel.sh/v4/ai/language-model",
    requestBodyValues: {},
    statusCode,
    isRetryable,
    responseHeaders: { "retry-after": "60" },
    responseBody: '{"error":{"type":"rate_limit_exceeded"}}',
  });
}

describe("chatErrorMessage", () => {
  it("explains rate limits from the model provider", () => {
    expect(chatErrorMessage(apiError(429))).toMatch(/wait a minute/);
  });

  it("looks inside the error the SDK throws after its retries", () => {
    const error = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(429), apiError(429), apiError(429)],
    });

    expect(chatErrorMessage(error)).toMatch(/wait a minute/);
  });

  it.each([apiError(500), new Error("boom"), "oops", null])(
    "falls back to a generic message for %s",
    (error) => {
      expect(chatErrorMessage(error)).toBe(
        "Something went wrong while answering. Please try again.",
      );
    },
  );

  it("is what the user sees when the model fails mid-chat", async () => {
    const model = new MockLanguageModelV4({
      // Not retryable, so the SDK doesn't wait between retries.
      doStream: async () => {
        throw apiError(429, false);
      },
    });
    const agent = createAgent({
      model,
      client: createPxClient({ ...SSB_CONFIG, fetch: vi.fn() }),
    });

    const response = await handleChat(
      post({ messages: [userMessage("Hello")] }),
      agent,
    );

    expect(await response.text()).toContain("wait a minute");
  });
});

describe("describeError", () => {
  it("shows every attempt with its status, headers and parsed body", () => {
    const error = new RetryError({
      message: "Failed after 2 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(429), apiError(429)],
    });

    expect(describeError(error)).toEqual({
      name: "AI_RetryError",
      reason: "maxRetriesExceeded",
      attempts: Array(2).fill({
        name: "AI_APICallError",
        statusCode: 429,
        isRetryable: true,
        url: "https://ai-gateway.vercel.sh/v4/ai/language-model",
        responseHeaders: { "retry-after": "60" },
        responseBody: { error: { type: "rate_limit_exceeded" } },
      }),
    });
  });

  it("keeps a response body that is not JSON as text", () => {
    const error = new APICallError({
      message: "Bad gateway",
      url: "https://example.com",
      requestBodyValues: {},
      statusCode: 502,
      responseBody: "<html>Bad gateway</html>",
    });

    expect(describeError(error)).toMatchObject({
      responseBody: "<html>Bad gateway</html>",
    });
  });

  it("follows the cause of a gateway error to the HTTP error", () => {
    const error = Object.assign(
      new Error("Rate limit exceeded", { cause: apiError(429) }),
      {
        name: "GatewayRateLimitError",
        statusCode: 429,
        type: "rate_limit_exceeded",
      },
    );

    expect(describeError(error)).toMatchObject({
      name: "GatewayRateLimitError",
      statusCode: 429,
      type: "rate_limit_exceeded",
      cause: { responseHeaders: { "retry-after": "60" } },
    });
  });

  it("falls back to name and message for other errors", () => {
    expect(describeError(new TypeError("nope"))).toEqual({
      name: "TypeError",
      message: "nope",
    });
  });
});
