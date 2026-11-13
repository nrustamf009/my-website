import type { FollowUpEmail, NotesExtraction, OutreachDraft } from "./schemas";

/**
 * Facts for AI drafts. Every number is ALREADY FORMATTED by the engine ("$412/mo", "7.875%").
 * The model may only quote these strings; a guard rejects drafts with any other $ or % figure.
 */
export interface OutreachFacts {
  loName: string;
  companyName: string;
  borrowerFirstName: string;
  propertyAddress: string;
  reasons: string[];
  benefit: string | null;
  netOf: string | null;
}

export interface FollowUpFacts {
  loName: string;
  companyName: string;
  loPhone: string | null;
  investorFirstName: string;
  propertyAddress: string | null;
  summary: string;
  nextSteps: string[];
  checklist: string[];
  scenarioUrl: string | null;
}

export interface AiClient {
  readonly mode: "claude" | "mock";
  extractNotes(text: string): Promise<NotesExtraction>;
  draftOutreach(f: OutreachFacts, tone: string): Promise<OutreachDraft>;
  draftFollowUp(f: FollowUpFacts, tone: string): Promise<FollowUpEmail>;
}

export type { FollowUpEmail, NotesExtraction, OutreachDraft };
