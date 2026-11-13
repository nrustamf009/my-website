import type { Prepay, Product } from "./types";
import { balanceAfter } from "./amortization";
import { applyRatio, type Cents, type Milli, type Ratio } from "./units";

/** Penalty percentage by loan year. */
export const PREPAY_SCHEDULES: Record<Prepay, number[]> = {
  "5-4-3-2-1": [5, 4, 3, 2, 1],
  "3-2-1": [3, 2, 1],
  "5-5-5-5-5": [5, 5, 5, 5, 5],
  "3-3-3": [3, 3, 3],
  "2-1": [2, 1],
  "1": [1],
  NONE: [],
};

export function prepayTermMonths(type: Prepay): number {
  return PREPAY_SCHEDULES[type].length * 12;
}

/** Penalty ratio for a payoff in loan month N (1-based: months 1–12 are year 1). */
export function prepayPenaltyRatio(type: Prepay, month: number): Ratio {
  if (month < 1) return 0;
  const pct = PREPAY_SCHEDULES[type][Math.ceil(month / 12) - 1] ?? 0;
  return pct * 100;
}

/** Penalty in cents for paying off `balanceCents` in loan month N. */
export function prepayPenaltyCents(type: Prepay, balanceCents: Cents, month: number): Cents {
  return applyRatio(balanceCents, prepayPenaltyRatio(type, month));
}

export interface PrepayRow {
  year: number;
  penaltyRatio: Ratio;
  /** Balance at the start of the year (payoff in its first month). */
  balanceCents: Cents;
  penaltyCents: Cents;
}

/** Year-by-year penalty table for the investor ("if you sell or refinance in year N"). */
export function prepaySchedule(type: Prepay, product: Product, loanCents: Cents, rateMilli: Milli): PrepayRow[] {
  return PREPAY_SCHEDULES[type].map((pct, i) => {
    const balanceCents = balanceAfter(product, loanCents, rateMilli, i * 12);
    const penaltyRatio = pct * 100;
    return { year: i + 1, penaltyRatio, balanceCents, penaltyCents: applyRatio(balanceCents, penaltyRatio) };
  });
}
