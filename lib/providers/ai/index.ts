import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { ClaudeAi } from "./claude";
import { MockAi } from "./mock";
import type { AiClient } from "./types";

export type { AiClient, CallExtraction, FollowUpEmail, OutreachContext, FollowUpContext } from "./types";
export { CallExtractionSchema } from "./schemas";

export function getAi(): AiClient {
  return env.anthropicKey ? new ClaudeAi(env.anthropicKey, env.anthropicModel) : new MockAi();
}

/** Run an AI task; if Claude fails, fall back to the mock so the broker is never blocked. */
export async function withAiFallback<T>(task: string, run: (ai: AiClient) => Promise<T>): Promise<{ value: T; mode: "claude" | "mock" }> {
  const ai = getAi();
  try {
    return { value: await run(ai), mode: ai.mode };
  } catch (err) {
    if (ai.mode === "mock") throw err;
    log.error("ai.failed_falling_back_to_mock", err, { task });
    return { value: await run(new MockAi()), mode: "mock" };
  }
}
