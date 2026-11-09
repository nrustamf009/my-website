import type { CallExtraction, FollowUpEmail } from "./schemas";

export interface OutreachContext {
  brokerName: string;
  companyName: string;
  borrowerFirstName: string;
  propertyAddress: string;
  /** Human-readable reasons, e.g. "Prepayment penalty ended on Mar 3, 2026". */
  reasons: string[];
  /** Human-readable benefit, e.g. "About $310/month lower payment at today's rates". */
  benefit: string;
}

export interface FollowUpContext {
  brokerName: string;
  companyName: string;
  brokerPhone?: string | null;
  investorFirstName: string;
  propertyAddress?: string | null;
  summary: string;
  nextSteps: string[];
  checklist: string[];
  scenarioUrl?: string | null;
}

export interface AiClient {
  readonly mode: "claude" | "mock";
  extractCall(transcript: string): Promise<CallExtraction>;
  draftOutreach(ctx: OutreachContext, tone: string): Promise<string>;
  draftFollowUpEmail(ctx: FollowUpContext, tone: string): Promise<FollowUpEmail>;
}

export type { CallExtraction, FollowUpEmail };
