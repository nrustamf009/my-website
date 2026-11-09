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
  annualPITIA: number;
  monthlyCashFlow: number;
}

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
    annualPITIA: pitia * 12,
    monthlyCashFlow: monthlyRent - pitia,
  };
}
