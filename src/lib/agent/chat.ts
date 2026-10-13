import { APICallError, createAgentUIStreamResponse, RetryError } from "ai";
import { z } from "zod";

import type { NumberfjordAgent } from "./agent";

// Every message is resent to the model on each step, so long chats get expensive.
export const MAX_MESSAGES = 20;

const chatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(MAX_MESSAGES),
});

export async function handleChat(request: Request, agent: NumberfjordAgent) {
  const body = chatRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: `Send 1 to ${MAX_MESSAGES} messages.` },
      { status: 400 },
    );
  }

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.data.messages,
    abortSignal: request.signal,
    onError: (error) => {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[chat] model error:",
          JSON.stringify(describeError(error), null, 2),
        );
      }
      return chatErrorMessage(error);
    },
  });
}

// The SDK logs errors too, but Node cuts nested objects off at depth 2.
export function describeError(error: unknown): unknown {
  if (RetryError.isInstance(error)) {
    return {
      name: error.name,
      reason: error.reason,
      attempts: error.errors.map(describeError),
    };
  }
  if (APICallError.isInstance(error)) {
    return {
      name: error.name,
      statusCode: error.statusCode,
      isRetryable: error.isRetryable,
      url: error.url,
      responseHeaders: error.responseHeaders,
      responseBody: parseJson(error.responseBody),
    };
  }
  if (error instanceof Error) {
    // Gateway errors carry statusCode and type, and wrap the HTTP error in cause.
    const { statusCode, type } = error as {
      statusCode?: number;
      type?: string;
    };
    return {
      name: error.name,
      message: error.message,
      ...(statusCode !== undefined && { statusCode }),
      ...(type !== undefined && { type }),
      ...(error.cause !== undefined && { cause: describeError(error.cause) }),
    };
  }
  return error;
}

function parseJson(text: string | undefined) {
  try {
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return text;
  }
}

// The full error is logged on the server; this is what the user sees.
export function chatErrorMessage(error: unknown) {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (statusCode(cause) === 429) {
    return "The AI model is getting too many requests right now. Please wait a minute and try again.";
  }
  return "Something went wrong while answering. Please try again.";
}

function statusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? error.statusCode
    : undefined;
}
