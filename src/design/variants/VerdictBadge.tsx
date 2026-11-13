"use client";

import type { Verdict } from "@/lib/dscr";
import { t } from "@/lib/strings/en";
import { useTheme } from "../ThemeContext";

/** Theme-branching (DESIGN.md §6): maison italic display text, terminal mono chip, atelier bold sentence. The label is always text. */
export function VerdictBadge({ verdict, size = "lg", testId = "verdict" }: { verdict: Verdict; size?: "lg" | "sm"; testId?: string }) {
  const { variants } = useTheme();
  const label = t.verdict[verdict];
  if (variants.verdict === "chip") {
    const tone = verdict === "STRONG" ? "bg-accent text-on-accent" : verdict === "BORDERLINE" ? "bg-warn text-on-warn" : verdict === "NEEDS_ADJUSTMENT" ? "border border-ink text-ink" : "border border-negative text-negative";
    return <span className={`inline-flex items-center rounded-sm px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-wider ${tone}`} data-testid={testId}>{label}</span>;
  }
  if (variants.verdict === "sentence") {
    return (
      <span className={size === "lg" ? "font-display text-[length:var(--type-section-size)] font-bold leading-tight tracking-tight" : "font-bold"}>
        <span data-testid={testId}>{label}</span>
        <span aria-hidden>.</span>
      </span>
    );
  }
  return <span className={`font-display italic ${size === "lg" ? "text-[length:var(--type-option-letter-size)] leading-tight" : ""}`} data-testid={testId}>{label}</span>;
}
