import type { Scenario, ScenarioOption } from "@prisma/client";
import { compareOptions, computeScenarioOption, type OptionComparison, type PrepayType, type ScenarioOptionResult } from "@/lib/dscr";

export type ScenarioWithOptions = Scenario & { options: ScenarioOption[] };

export interface OptionWithResult {
  option: ScenarioOption;
  result: ScenarioOptionResult;
  /** Comparison against the option with the lowest upfront cost (null for that option itself). */
  vsBase: (OptionComparison & { baseLabel: string }) | null;
  /** Rent covers the payment at least `minDscr` times. */
  meetsMinDscr: boolean;
}

/** Run every option of a scenario through the math core and flag the "best" ones. */
export function computeScenario(s: ScenarioWithOptions, minDscr = 1) {
  const escrow = { taxesMonthly: s.taxesMonthly, insuranceMonthly: s.insuranceMonthly, hoaMonthly: s.hoaMonthly };
  const base = [...s.options]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((option) => ({
      option,
      result: computeScenarioOption({
        propertyValue: s.propertyValue,
        monthlyRent: s.monthlyRent,
        escrow,
        isPurchase: s.loanPurpose === "PURCHASE",
        option: { ...option, prepay: option.prepay as PrepayType },
      }),
    }));
  const cheapest = base.reduce((m, r) => (r.result.upfrontCosts < m.result.upfrontCosts ? r : m), base[0]!);
  const rows: OptionWithResult[] = base.map((r) => ({
    ...r,
    vsBase: r === cheapest ? null : { ...compareOptions(cheapest.result, r.result), baseLabel: cheapest.option.label },
    meetsMinDscr: (r.result.dscr ?? 0) + 1e-9 >= minDscr,
  }));
  const minBy = (f: (r: OptionWithResult) => number) => rows.reduce((best, r) => (f(r) < f(best) ? r : best), rows[0]!).option.id;
  const best = rows.length
    ? {
        lowestPayment: minBy((r) => r.result.pitia),
        highestDscr: minBy((r) => -(r.result.dscr ?? 0)),
        lowestCash: minBy((r) => r.result.cashToClose),
        lowestFiveYear: minBy((r) => r.result.fiveYearCost),
      }
    : null;
  const recommended = s.options.find((o) => o.recommended)?.id ?? null;
  return { rows, best, recommended };
}

export const PURPOSE_LABEL: Record<string, string> = { PURCHASE: "Purchase", RATE_TERM: "Rate & term refinance", CASH_OUT: "Cash-out refinance" };

/** Plain-English explanation of each prepayment structure, for investors. */
export const PREPAY_EXPLAINER: Record<string, string> = {
  "5-4-3-2-1": "Selling or refinancing in years 1–5 costs 5%, 4%, 3%, 2%, then 1% of the balance. Usually buys a lower rate.",
  "3-2-1": "Selling or refinancing in years 1–3 costs 3%, 2%, then 1% of the balance. More flexible than 5 years.",
  NONE: "No fee to sell or refinance at any time. Most flexible, usually a slightly higher rate.",
};
