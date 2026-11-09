import type { Scenario, ScenarioOption } from "@prisma/client";
import { computeScenarioOption, type PrepayType, type ScenarioOptionResult } from "@/lib/dscr";

export type ScenarioWithOptions = Scenario & { options: ScenarioOption[] };

export interface OptionWithResult {
  option: ScenarioOption;
  result: ScenarioOptionResult;
}

/** Run every option of a scenario through the math core and flag the "best" ones. */
export function computeScenario(s: ScenarioWithOptions) {
  const escrow = { taxesMonthly: s.taxesMonthly, insuranceMonthly: s.insuranceMonthly, hoaMonthly: s.hoaMonthly };
  const rows: OptionWithResult[] = [...s.options]
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
  const minBy = (f: (r: OptionWithResult) => number) => rows.reduce((best, r) => (f(r) < f(best) ? r : best), rows[0]!);
  const best = rows.length
    ? {
        lowestPayment: minBy((r) => r.result.pitia).option.id,
        highestDscr: minBy((r) => -(r.result.dscr ?? 0)).option.id,
        lowestCash: minBy((r) => r.result.cashToClose).option.id,
      }
    : null;
  return { rows, best };
}

export const PURPOSE_LABEL: Record<string, string> = { PURCHASE: "Purchase", RATE_TERM: "Rate & term refinance", CASH_OUT: "Cash-out refinance" };
