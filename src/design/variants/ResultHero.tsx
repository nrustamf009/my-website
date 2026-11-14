"use client";

import type { ReactNode } from "react";
import type { Verdict } from "@/lib/dscr";
import { dscr } from "@/lib/format";
import { useTheme } from "../ThemeContext";
import { CoverageMeter } from "./CoverageMeter";
import { VerdictBadge } from "./VerdictBadge";

export interface ResultHeroProps {
  address?: string | null;
  value: number | null;
  verdict: Verdict;
  min: number;
  strong: number;
  explanation: ReactNode;
  /** Extra line under the verdict (terminal: next to the chip). */
  note?: ReactNode;
}

/**
 * Theme-branching (DESIGN.md §6). maison: dark inverse panel, grotesk numeral with display verdict ·
 * terminal: surface card with a gauge and a mono numeral · atelier: numeral on white, then a full-bleed accent block.
 */
export function ResultHero({ address, value, verdict, min, strong, explanation, note }: ResultHeroProps) {
  const { variants } = useTheme();
  const numeral = (
    <span className="type-hero-numeral num block" data-testid="dscr-value">
      {dscr(value)}
    </span>
  );

  if (variants.meter === "gauge") {
    return (
      <section className="rounded-2xl border border-rule bg-surface p-5" aria-label="Estimated DSCR">
        <div className="flex justify-between">
          <span className="type-eyebrow text-muted">Debt service coverage</span>
          <span className="type-eyebrow text-muted">Estimate</span>
        </div>
        <div className="mt-3">
          <CoverageMeter value={value} min={min} strong={strong}>
            <span className="text-ink">{numeral}</span>
          </CoverageMeter>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <VerdictBadge verdict={verdict} />
          {note && <span className="type-body-small text-muted">{note}</span>}
        </div>
        <p className="mt-3 text-ink-2">{explanation}</p>
      </section>
    );
  }

  if (variants.meter === "linear-block") {
    return (
      <section aria-label="Estimated DSCR">
        <div className="flex items-baseline justify-between gap-3">
          <span className="type-eyebrow text-ink">Coverage</span>
          {address && <span className="type-body-small truncate text-ink-2">{address}</span>}
        </div>
        <div className="-ml-2 mt-1 overflow-hidden text-ink">{numeral}</div>
        <div className="-mx-[var(--space-page)] mt-4 bg-accent px-[var(--space-page)] py-6 text-on-accent sm:mx-0 sm:px-6">
          <VerdictBadge verdict={verdict} />
          <p className="mt-2 text-on-accent">{explanation}</p>
          {note && <p className="type-body-small mt-1 text-on-accent">{note}</p>}
          <div className="mt-5">
            <CoverageMeter value={value} min={min} strong={strong} onBlock />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="-mx-[var(--space-page)] bg-inverse px-[var(--space-page)] py-7 text-on-inverse sm:mx-0 sm:rounded-2xl sm:px-7" aria-label="Estimated DSCR">
      <div className="type-eyebrow text-on-inverse-muted">Estimated debt service coverage</div>
      {address && <div className="mt-2 text-on-inverse">{address}</div>}
      <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-1">
        {numeral}
        <div className="min-w-0 pb-3">
          <span className="text-on-inverse"><VerdictBadge verdict={verdict} /></span>
          <div className="type-body-small text-on-inverse-muted">{note ?? "Estimate, not an offer"}</div>
        </div>
      </div>
      <div className="mt-6">
        <CoverageMeter value={value} min={min} strong={strong} onBlock />
      </div>
      <p className="mt-4 text-on-inverse">{explanation}</p>
    </section>
  );
}
