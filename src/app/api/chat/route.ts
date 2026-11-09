import { createAgent } from "@/lib/agent/agent";
import { handleChat } from "@/lib/agent/chat";
import { createChatRateLimiters } from "@/lib/agent/rate-limit";

const rateLimiters = createChatRateLimiters();

export async function POST(request: Request) {
  return handleChat(request, createAgent(), rateLimiters);
}
