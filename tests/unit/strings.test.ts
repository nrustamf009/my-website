import { describe, expect, it } from "vitest";
import { t } from "@/lib/strings/en";
import { BANNED_WORDS } from "@/lib/compliance/banned-words";
import { DEFAULT_DISCLAIMER, CONSENT_TEXT } from "@/lib/compliance/disclaimers";

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (typeof v === "function") {
    try {
      const r = (v as (...a: string[]) => unknown)("X", "Y", "Z");
      collect(r, out);
    } catch {
      /* non-string helper */
    }
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
  return out;
}

describe("investor-facing strings", () => {
  it("contain no banned words (approved, pre-qualified, qualifies, guaranteed, commitment…)", () => {
    const hits = collect(t).filter((s) => BANNED_WORDS.test(s.replace(/not (?:a |an offer or (?:a )?)?commitment to lend/gi, "")));
    expect(hits).toEqual([]);
  });
  it("consent texts are clean; the disclaimer only uses 'commitment' as a negation", () => {
    expect(collect(CONSENT_TEXT).filter((s) => BANNED_WORDS.test(s))).toEqual([]);
    expect(BANNED_WORDS.test(DEFAULT_DISCLAIMER.replace(/not a commitment to lend/gi, ""))).toBe(false);
  });
});
