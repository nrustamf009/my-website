import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { ClaudeAi } from "./claude";
import { MockAi } from "./mock";
import { checkDraft } from "./guard";
import type { AiClient, FollowUpEmail, FollowUpFacts, NotesExtraction, OutreachDraft, OutreachFacts } from "./types";

export type { AiClient, FollowUpEmail, FollowUpFacts, NotesExtraction, OutreachDraft, OutreachFacts } from "./types";
export { NotesExtractionSchema } from "./schemas";

export function getAi(): AiClient {
  return env.anthropicKey ? new ClaudeAi(env.anthropicKey, env.anthropicModel) : new MockAi();
}

type Mode = "claude" | "mock";

/** Extraction: Claude, falling back to the mock on any failure. */
export async function extractNotes(text: string): Promise<{ value: NotesExtraction; mode: Mode }> {
  const ai = getAi();
  try {
    return { value: await ai.extractNotes(text), mode: ai.mode };
  } catch (err) {
    if (ai.mode === "mock") throw err;
    log.error("ai.extract_failed", err);
    return { value: await new MockAi().extractNotes(text), mode: "mock" };
  }
}

/** Drafts: Claude → guard (no invented figures, no banned words) → one retry → template fallback. */
async function guarded<T>(task: string, facts: unknown, run: (ai: AiClient) => Promise<T>, text: (v: T) => string): Promise<{ value: T; mode: Mode }> {
  const ai = getAi();
  if (ai.mode === "claude") {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const v = await run(ai);
        const check = checkDraft(text(v), facts);
        if (check.ok) return { value: v, mode: "claude" };
        log.warn("ai.draft_rejected", { task, reason: check.reason.replace(/\$[\d,.]+/, "$…") });
      } catch (err) {
        log.error("ai.draft_failed", err, { task });
        break;
      }
    }
  }
  return { value: await run(new MockAi()), mode: "mock" };
}

export const draftOutreach = (f: OutreachFacts, tone: string) => guarded<OutreachDraft>("outreach", f, (ai) => ai.draftOutreach(f, tone), (v) => `${v.emailSubject}\n${v.emailBody}\n${v.sms}`);
export const draftFollowUp = (f: FollowUpFacts, tone: string) => guarded<FollowUpEmail>("followup", f, (ai) => ai.draftFollowUp(f, tone), (v) => `${v.subject}\n${v.body}`);
