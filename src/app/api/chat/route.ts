import { createAgent } from "@/lib/agent/agent";
import { handleChat } from "@/lib/agent/chat";

export async function POST(request: Request) {
  return handleChat(request, createAgent());
}
