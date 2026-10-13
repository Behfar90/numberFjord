// Free Gateway model while the account has no paid credits. Switch to
// "anthropic/claude-sonnet-5.5" by setting AGENT_MODEL once credits are added.
const DEFAULT_MODEL = "inclusionai/ling-3.1-flash";

export const agentModel = process.env.AGENT_MODEL || DEFAULT_MODEL;
