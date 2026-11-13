import type { Mode, Prepay, Product, ProgramGrid } from "./types";
import { PRODUCT_SPECS, productPayments } from "./amortization";
import { prepaySchedule, type PrepayRow } from "./prepay";
import { applyRatio, monthly, ratioCeil, ratioFloor, type Cents, type Milli, type Ratio } from "./units";

export const COST_HORIZON_MONTHS = 60;

export interface ScenarioOptionInput {
  product: Product;
  loanAmountCents: Cents;
  rateMilli: Milli;
  /** Points as ratio of loan (1 point = 100); negative = lender credit. */
  pointsRatio: Ratio;
  /** Lender/origination fees. */
  feesCents: Cents;
  prepay: Prepay;
}

export interface ScenarioPropertyInput {
  mode: Mode;
  valueCents: Cents;
  rentCents: Cents;
  taxesAnnualCents: Cents;
  insuranceAnnualCents: Cents;
  hoaMonthlyCents: Cents;
}

export interface ScenarioOptionResult {
  piCents: Cents;
  postIoPiCents: Cents | null;
  pitiaCents: Cents;
  postIoPitiaCents: Cents | null;
  dscrRatio: Ratio | null;
  postIoDscrRatio: Ratio | null;
  cashFlowCents: Cents;
  ltvRatio: Ratio;
  downPaymentCents: Cents;
  /** Positive = points paid, negative = lender credit received. */
  pointsCents: Cents;
  /** Total closing costs: the grid estimate, but never less than the option's lender fees. */
  closingCostsCents: Cents;
  prepaidsCents: Cents;
  cashToCloseCents: Cents;
  fiveYearCostCents: Cents;
  ioMonths: number;
  fixedMonths: number | null;
  prepaySchedule: PrepayRow[];
}

/**
 * One Scenario Sheet option. Cash to close (purchase) = down payment + closing costs + prepaids + points.
 * Refinances finance closing costs, so cash to close = prepaids + points (credits reduce it).
 * 5-year cost = 60 monthly payments (stepping up after IO) + points + lender fees. Excludes down payment.
 */
export function computeScenarioOption(p: ScenarioPropertyInput, o: ScenarioOptionInput, grid: ProgramGrid): ScenarioOptionResult {
  const taxesM = monthly(p.taxesAnnualCents);
  const insM = monthly(p.insuranceAnnualCents);
  const escrow = taxesM + insM + p.hoaMonthlyCents;
  const pay = productPayments(o.product, o.loanAmountCents, o.rateMilli);
  const pitia = pay.initialPI + escrow;
  const postIoPitia = pay.postIoPI === null ? null : pay.postIoPI + escrow;
  const isPurchase = p.mode === "PURCHASE";
  const down = isPurchase ? Math.max(0, p.valueCents - o.loanAmountCents) : 0;
  const pointsCents = applyRatio(Math.abs(o.loanAmountCents), Math.abs(o.pointsRatio)) * Math.sign(o.pointsRatio || 0);
  const estimate = applyRatio(isPurchase ? p.valueCents : o.loanAmountCents, isPurchase ? grid.closingCostRatio.purchase : grid.closingCostRatio.refi);
  const closing = Math.max(estimate, o.feesCents);
  const prepaids = insM * grid.prepaids.insuranceMonths + taxesM * grid.prepaids.taxMonths;
  const cashToClose = Math.max(0, isPurchase ? down + closing + prepaids + pointsCents : prepaids + pointsCents);
  const spec = PRODUCT_SPECS[o.product];
  const ioInHorizon = Math.min(COST_HORIZON_MONTHS, spec.ioMonths);
  const fiveYear = pitia * ioInHorizon + (postIoPitia ?? pitia) * (COST_HORIZON_MONTHS - ioInHorizon) + Math.max(0, pointsCents) + o.feesCents;
  return {
    piCents: pay.initialPI,
    postIoPiCents: pay.postIoPI,
    pitiaCents: pitia,
    postIoPitiaCents: postIoPitia,
    dscrRatio: ratioFloor(p.rentCents, pitia),
    postIoDscrRatio: postIoPitia === null ? null : ratioFloor(p.rentCents, postIoPitia),
    cashFlowCents: p.rentCents - pitia,
    ltvRatio: ratioCeil(o.loanAmountCents, p.valueCents) ?? 0,
    downPaymentCents: down,
    pointsCents,
    closingCostsCents: closing,
    prepaidsCents: prepaids,
    cashToCloseCents: cashToClose,
    fiveYearCostCents: fiveYear,
    ioMonths: spec.ioMonths,
    fixedMonths: spec.fixedMonths,
    prepaySchedule: prepaySchedule(o.prepay, o.product, o.loanAmountCents, o.rateMilli),
  };
}

export interface OptionComparison {
  extraUpfrontCents: Cents;
  monthlySavingsCents: Cents;
  /** Whole months until payment savings repay the extra upfront cost (rounded up); null if n/a. */
  breakevenMonths: number | null;
}

export function compareOptions(base: ScenarioOptionResult, other: ScenarioOptionResult, baseOpt: ScenarioOptionInput, otherOpt: ScenarioOptionInput): OptionComparison {
  const upfront = (r: ScenarioOptionResult, o: ScenarioOptionInput) => Math.max(0, r.pointsCents) + o.feesCents;
  const extra = upfront(other, otherOpt) - upfront(base, baseOpt);
  const savings = base.pitiaCents - other.pitiaCents;
  return { extraUpfrontCents: extra, monthlySavingsCents: savings, breakevenMonths: extra > 0 && savings > 0 ? Math.ceil(extra / savings) : null };
}

/** Loan amount for a target LTV, rounded down to the nearest $500. */
export function loanFromLtv(valueCents: Cents, ltvRatio: Ratio): Cents {
  return Math.floor((valueCents * ltvRatio) / 10_000 / 50_000) * 50_000;
}
