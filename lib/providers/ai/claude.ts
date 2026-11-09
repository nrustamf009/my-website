import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CallExtractionSchema, FollowUpEmailSchema } from "./schemas";
import { EXTRACTION_SYSTEM, FOLLOWUP_SYSTEM, OUTREACH_SYSTEM } from "./prompts";
import type { AiClient, CallExtraction, FollowUpContext, FollowUpEmail, OutreachContext } from "./types";

/** Claude implementation. Uses structured outputs for JSON and server-side refusal fallbacks. */
export class ClaudeAi implements AiClient {
  readonly mode = "claude" as const;
  private client: Anthropic;
  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  private base() {
    return {
      model: this.model,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    };
  }

  async extractCall(transcript: string): Promise<CallExtraction> {
    const res = await this.client.beta.messages.parse({
      ...this.base(),
      max_tokens: 8000,
      output_config: { effort: "medium", format: betaZodOutputFormat(CallExtractionSchema) },
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: `<transcript>\n${transcript}\n</transcript>\n\nExtract the deal details.` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("AI extraction unavailable");
    return res.parsed_output;
  }

  async draftOutreach(ctx: OutreachContext, tone: string): Promise<string> {
    const res = await this.client.beta.messages.create({
      ...this.base(),
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: OUTREACH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Tone: ${tone}\n\nLoan officer: ${ctx.brokerName} (${ctx.companyName})\nClient first name: ${ctx.borrowerFirstName}\nProperty: ${ctx.propertyAddress}\nReasons:\n${ctx.reasons.map((r) => `- ${r}`).join("\n")}\nEstimated benefit: ${ctx.benefit}\n\nWrite the message.`,
        },
      ],
    });
    if (res.stop_reason === "refusal") throw new Error("AI draft unavailable");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) throw new Error("Empty AI draft");
    return text;
  }

  async draftFollowUpEmail(ctx: FollowUpContext, tone: string): Promise<FollowUpEmail> {
    const res = await this.client.beta.messages.parse({
      ...this.base(),
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(FollowUpEmailSchema) },
      system: FOLLOWUP_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Tone: ${tone}\n\nLoan officer: ${ctx.brokerName}, ${ctx.companyName}${ctx.brokerPhone ? `, ${ctx.brokerPhone}` : ""}\nInvestor first name: ${ctx.investorFirstName}\nProperty: ${ctx.propertyAddress ?? "not specified"}\nCall summary: ${ctx.summary}\nNext steps:\n${ctx.nextSteps.map((s) => `- ${s}`).join("\n")}\nDocuments needed:\n${ctx.checklist.map((s) => `- ${s}`).join("\n")}\n${ctx.scenarioUrl ? `Scenario link: ${ctx.scenarioUrl}` : ""}\n\nWrite the email.`,
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("AI draft unavailable");
    return res.parsed_output;
  }
}
