import { createAgentUIStreamResponse } from "ai";
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
  });
}
