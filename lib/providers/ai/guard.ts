import { BANNED_WORDS } from "@/lib/compliance/banned-words";

const FIGURE = /\$\s?[\d,]+(?:\.\d+)?(?:\s?[kKmM])?|\d+(?:\.\d+)?\s?%/g;

/** Every $ or % figure in a draft must appear verbatim in the facts; banned words are rejected. */
export function checkDraft(text: string, facts: unknown): { ok: true } | { ok: false; reason: string } {
  const allowed = JSON.stringify(facts).replace(/\s/g, "");
  for (const m of text.match(FIGURE) ?? []) {
    if (!allowed.includes(m.replace(/\s/g, ""))) return { ok: false, reason: `unsupported figure ${m}` };
  }
  const banned = text.match(BANNED_WORDS);
  if (banned) return { ok: false, reason: `banned word ${banned[0]}` };
  return { ok: true };
}
