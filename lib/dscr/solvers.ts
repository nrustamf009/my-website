import type { Escrow } from "./types";
import { assertNonNegative, assertPositive, assertRatio } from "./guards";
import { monthlyTIH, paymentFactor } from "./payment";

export interface LoanSizingInput {
  price: number;
  monthlyRent: number;
  minDscr: number;
  maxLtv: number;
  ratePct: number;
  termYears?: number;
  interestOnly?: boolean;
  escrow: Escrow;
}

export interface MaxLoanResult {
  maxLoan: number;
  /** Largest loan whose PITIA keeps DSCR >= minDscr. */
  byDscr: number;
  /** maxLtv * price. */
  byLtv: number;
  limitedBy: "DSCR" | "LTV";
}

/**
 * Max loan amount given min DSCR and max LTV.
 * DSCR constraint: P&I(L) <= rent / minDscr - (T + I + HOA)  =>  L <= capacity / factor.
 */
export function maxLoanAmount(input: LoanSizingInput): MaxLoanResult {
  const { price, monthlyRent, minDscr, maxLtv, ratePct, termYears = 30, interestOnly = false, escrow } = input;
  assertNonNegative("price", price);
  assertNonNegative("monthlyRent", monthlyRent);
  assertPositive("minDscr", minDscr);
  assertRatio("maxLtv", maxLtv);

  const capacity = monthlyRent / minDscr - monthlyTIH(escrow);
  const factor = paymentFactor(ratePct, termYears, interestOnly);
  let byDscr: number;
  if (capacity <= 0) byDscr = 0;
  else if (factor === 0) byDscr = Number.POSITIVE_INFINITY;
  else byDscr = capacity / factor;

  const byLtv = price * maxLtv;
  const limitedBy = byDscr < byLtv ? "DSCR" : "LTV";
  return { maxLoan: Math.min(byDscr, byLtv), byDscr, byLtv, limitedBy };
}

/** Minimum down payment (as ratio and dollars) that satisfies both DSCR and LTV. */
export function minDownPayment(input: LoanSizingInput): { pct: number; amount: number; limitedBy: "DSCR" | "LTV" } {
  const { maxLoan, limitedBy } = maxLoanAmount(input);
  if (input.price === 0) return { pct: 0, amount: 0, limitedBy };
  const pct = Math.min(1, Math.max(0, 1 - maxLoan / input.price));
  return { pct, amount: pct * input.price, limitedBy };
}

/**
 * Max purchase price that keeps DSCR >= minDscr at a given down payment,
 * with taxes/insurance scaling as % of price:
 *   rent / minDscr = factor * (1 - d) * P + (tax% + ins%) / 1200 * P + HOA
 *   =>  P = (rent / minDscr - HOA) / (factor * (1 - d) + (tax% + ins%) / 1200)
 */
export function maxPurchasePrice(input: {
  monthlyRent: number;
  downPaymentPct: number;
  minDscr: number;
  ratePct: number;
  termYears?: number;
  interestOnly?: boolean;
  taxRatePct: number;
  insuranceRatePct: number;
  hoaMonthly?: number;
}): number {
  const { monthlyRent, downPaymentPct, minDscr, ratePct, termYears = 30, interestOnly = false, taxRatePct, insuranceRatePct, hoaMonthly = 0 } = input;
  assertNonNegative("monthlyRent", monthlyRent);
  assertRatio("downPaymentPct", downPaymentPct);
  assertPositive("minDscr", minDscr);
  assertNonNegative("taxRatePct", taxRatePct);
  assertNonNegative("insuranceRatePct", insuranceRatePct);
  assertNonNegative("hoaMonthly", hoaMonthly);

  const numerator = monthlyRent / minDscr - hoaMonthly;
  if (numerator <= 0) return 0;
  const perDollar = paymentFactor(ratePct, termYears, interestOnly) * (1 - downPaymentPct) + (taxRatePct + insuranceRatePct) / 1200;
  if (perDollar === 0) return Number.POSITIVE_INFINITY;
  return numerator / perDollar;
}

/** Minimum monthly rent needed to reach the target DSCR. */
export function minRentForDscr(pitia: number, targetDscr: number): number {
  assertNonNegative("pitia", pitia);
  assertPositive("targetDscr", targetDscr);
  return pitia * targetDscr;
}
