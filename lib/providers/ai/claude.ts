import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FollowUpEmailSchema, NotesExtractionSchema, OutreachSchema } from "./schemas";
import { EXTRACTION_SYSTEM, FOLLOWUP_SYSTEM, OUTREACH_SYSTEM } from "./prompts";
import type { AiClient, FollowUpFacts, OutreachFacts } from "./types";

/** Claude with structured (JSON-schema) outputs and server-side refusal fallbacks. */
export class ClaudeAi implements AiClient {
  readonly mode = "claude" as const;
  private client: Anthropic;
  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  private base() {
    return { model: this.model, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  }

  async extractNotes(text: string) {
    const res = await this.client.beta.messages.parse({
      ...this.base(),
      max_tokens: 8000,
      output_config: { effort: "medium", format: betaZodOutputFormat(NotesExtractionSchema) },
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: `<notes>\n${text}\n</notes>\n\nExtract the deal details.` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("AI extraction unavailable");
    return res.parsed_output;
  }

  async draftOutreach(f: OutreachFacts, tone: string) {
    const res = await this.client.beta.messages.parse({
      ...this.base(),
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(OutreachSchema) },
      system: OUTREACH_SYSTEM,
      messages: [{ role: "user", content: `TONE: ${tone}\n\nFACTS (quote numbers exactly):\n${JSON.stringify(f, null, 2)}\n\nWrite the email and the text message.` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("AI draft unavailable");
    return res.parsed_output;
  }

  async draftFollowUp(f: FollowUpFacts, tone: string) {
    const res = await this.client.beta.messages.parse({
      ...this.base(),
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(FollowUpEmailSchema) },
      system: FOLLOWUP_SYSTEM,
      messages: [{ role: "user", content: `TONE: ${tone}\n\nFACTS:\n${JSON.stringify(f, null, 2)}\n\nWrite the email.` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("AI draft unavailable");
    return res.parsed_output;
  }
}
