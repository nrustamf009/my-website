import type { Escrow } from "./types";
import { assertNonNegative, assertPositive } from "./guards";

/**
 * Monthly principal & interest payment per $1 of loan.
 * Interest-only: r. Amortizing: r / (1 - (1 + r)^-n). Zero rate: 1 / n.
 */
export function paymentFactor(ratePct: number, termYears = 30, interestOnly = false): number {
  assertNonNegative("ratePct", ratePct);
  assertPositive("termYears", termYears);
  const r = ratePct / 100 / 12;
  const n = termYears * 12;
  if (interestOnly) return r;
  if (r === 0) return 1 / n;
  return r / (1 - Math.pow(1 + r, -n));
}

/** Monthly principal & interest. */
export function monthlyPI(params: {
  loanAmount: number;
  ratePct: number;
  termYears?: number;
  interestOnly?: boolean;
}): number {
  const { loanAmount, ratePct, termYears = 30, interestOnly = false } = params;
  assertNonNegative("loanAmount", loanAmount);
  if (loanAmount === 0) return 0;
  return loanAmount * paymentFactor(ratePct, termYears, interestOnly);
}

/** Monthly taxes and insurance derived from annual % of price. */
export function escrowFromPrice(
  price: number,
  taxRatePct: number,
  insuranceRatePct: number,
  hoaMonthly = 0,
): Escrow {
  assertNonNegative("price", price);
  assertNonNegative("taxRatePct", taxRatePct);
  assertNonNegative("insuranceRatePct", insuranceRatePct);
  assertNonNegative("hoaMonthly", hoaMonthly);
  return {
    taxesMonthly: (price * taxRatePct) / 100 / 12,
    insuranceMonthly: (price * insuranceRatePct) / 100 / 12,
    hoaMonthly,
  };
}

/** Taxes + insurance + HOA per month. */
export function monthlyTIH(escrow: Escrow): number {
  assertNonNegative("taxesMonthly", escrow.taxesMonthly);
  assertNonNegative("insuranceMonthly", escrow.insuranceMonthly);
  assertNonNegative("hoaMonthly", escrow.hoaMonthly);
  return escrow.taxesMonthly + escrow.insuranceMonthly + escrow.hoaMonthly;
}

/** PITIA = principal & interest + taxes + insurance + HOA. */
export function monthlyPITIA(pi: number, escrow: Escrow): number {
  assertNonNegative("pi", pi);
  return pi + monthlyTIH(escrow);
}

/** DSCR = monthly rent / PITIA. Returns null when PITIA is 0 (ratio undefined). */
export function dscr(monthlyRent: number, pitia: number): number | null {
  assertNonNegative("monthlyRent", monthlyRent);
  assertNonNegative("pitia", pitia);
  if (pitia === 0) return null;
  return monthlyRent / pitia;
}

/** Remaining principal after `monthsPaid` payments. */
export function remainingBalance(params: {
  loanAmount: number;
  ratePct: number;
  termYears?: number;
  interestOnly?: boolean;
  monthsPaid: number;
}): number {
  const { loanAmount, ratePct, termYears = 30, interestOnly = false, monthsPaid } = params;
  assertNonNegative("monthsPaid", monthsPaid);
  if (interestOnly || loanAmount === 0) return loanAmount;
  const n = termYears * 12;
  const k = Math.min(monthsPaid, n);
  const r = ratePct / 100 / 12;
  if (r === 0) return loanAmount * (1 - k / n);
  const pmt = monthlyPI({ loanAmount, ratePct, termYears });
  const growth = Math.pow(1 + r, k);
  return Math.max(0, loanAmount * growth - (pmt * (growth - 1)) / r);
}
