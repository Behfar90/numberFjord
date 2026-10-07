import {
  isStepCount,
  ToolLoopAgent,
  type InferAgentUIMessage,
  type LanguageModel,
} from "ai";

import { ssb, type PxClient } from "@/lib/ssb";

import { systemPrompt } from "./instructions";
import { agentModel } from "./model";
import { createPxTools } from "./tools";

export const MAX_STEPS = 10;

export interface AgentOptions {
  client?: PxClient;
  model?: LanguageModel;
  instructions?: string;
}

export function createAgent({
  client = ssb,
  model = agentModel,
  instructions = systemPrompt(),
}: AgentOptions = {}) {
  return new ToolLoopAgent({
    model,
    instructions,
    tools: createPxTools(client),
    stopWhen: isStepCount(MAX_STEPS),
  });
}

export type NumberfjordAgent = ReturnType<typeof createAgent>;
export type AgentUIMessage = InferAgentUIMessage<NumberfjordAgent>;
