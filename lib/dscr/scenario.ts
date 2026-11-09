import type { Escrow, PrepayType } from "./types";
import { assertNonNegative } from "./guards";
import { dscr as calcDscr, monthlyPI, monthlyPITIA } from "./payment";

export interface ScenarioOptionInput {
  loanAmount: number;
  ratePct: number;
  termYears: number;
  interestOnly: boolean;
  /** Length of the IO period in years (default 10). */
  ioYears?: number | null;
  prepay: PrepayType;
  pointsPct: number;
  lenderFees: number;
}

export interface ScenarioOptionResult {
  pi: number;
  pitia: number;
  dscr: number | null;
  ltv: number;
  downPayment: number;
  pointsCost: number;
  upfrontCosts: number;
  /** Down payment (purchase only) + points + lender fees. */
  cashToClose: number;
  /** Amortizing P&I after the IO period ends (IO loans only). */
  postIoPI: number | null;
  /** PITIA after the IO period ends (IO loans only). */
  postIoPITIA: number | null;
  annualPITIA: number;
  monthlyCashFlow: number;
  /** Payments plus upfront costs (points + fees) over the first 5 years. Excludes down payment. */
  fiveYearCost: number;
}

export const COST_HORIZON_YEARS = 5;

/** Compute one option of a Scenario Sheet. */
export function computeScenarioOption(params: {
  propertyValue: number;
  monthlyRent: number;
  escrow: Escrow;
  isPurchase: boolean;
  option: ScenarioOptionInput;
}): ScenarioOptionResult {
  const { propertyValue, monthlyRent, escrow, isPurchase, option } = params;
  assertNonNegative("propertyValue", propertyValue);
  assertNonNegative("pointsPct", option.pointsPct);
  assertNonNegative("lenderFees", option.lenderFees);
  const pi = monthlyPI({ loanAmount: option.loanAmount, ratePct: option.ratePct, termYears: option.termYears, interestOnly: option.interestOnly });
  const pitia = monthlyPITIA(pi, escrow);
  const ioYears = option.ioYears ?? 10;
  const postIoPI =
    option.interestOnly && option.termYears > ioYears
      ? monthlyPI({ loanAmount: option.loanAmount, ratePct: option.ratePct, termYears: option.termYears - ioYears })
      : null;
  const pointsCost = (option.loanAmount * option.pointsPct) / 100;
  const downPayment = isPurchase ? Math.max(0, propertyValue - option.loanAmount) : 0;
  const upfrontCosts = pointsCost + option.lenderFees;
  const postIoPITIA = postIoPI === null ? null : monthlyPITIA(postIoPI, escrow);
  // Months at the initial payment vs. the post-IO payment inside the 5-year horizon.
  const horizon = COST_HORIZON_YEARS * 12;
  const initialMonths = option.interestOnly && postIoPITIA !== null ? Math.min(horizon, ioYears * 12) : horizon;
  const fiveYearCost = upfrontCosts + pitia * initialMonths + (postIoPITIA ?? pitia) * (horizon - initialMonths);
  return {
    pi,
    pitia,
    dscr: calcDscr(monthlyRent, pitia),
    ltv: propertyValue > 0 ? option.loanAmount / propertyValue : 0,
    downPayment,
    pointsCost,
    upfrontCosts,
    cashToClose: downPayment + upfrontCosts,
    postIoPI,
    postIoPITIA,
    annualPITIA: pitia * 12,
    monthlyCashFlow: monthlyRent - pitia,
    fiveYearCost,
  };
}

/** Loan amount for a target LTV, rounded down to the nearest $500. */
export function loanFromLtv(propertyValue: number, ltv: number): number {
  return Math.floor((propertyValue * ltv) / 500) * 500;
}

export interface OptionComparison {
  /** Extra upfront cost (points + fees) of `other` vs. `base`. Negative = cheaper upfront. */
  extraUpfront: number;
  /** Monthly payment savings of `other` vs. `base`. Negative = higher payment. */
  monthlySavings: number;
  /** Months until lower payments repay the extra upfront cost; null when not applicable. */
  breakEvenMonths: number | null;
}

/** Compare two options: does paying more upfront (e.g. points) pay for itself, and when? */
export function compareOptions(base: ScenarioOptionResult, other: ScenarioOptionResult): OptionComparison {
  const extraUpfront = other.upfrontCosts - base.upfrontCosts;
  const monthlySavings = base.pitia - other.pitia;
  const breakEvenMonths = extraUpfront > 0 && monthlySavings > 0 ? extraUpfront / monthlySavings : null;
  return { extraUpfront, monthlySavings, breakEvenMonths };
}
