import type { Prepay } from "./types";
import { amortizingPayment, balanceAfter, interestOnlyPayment } from "./amortization";
import { prepayPenaltyCents, prepayPenaltyRatio } from "./prepay";
import { applyRatio, roundHalfUp, type Cents, type Milli, type Ratio } from "./units";

export type LoanProduct = "FIXED" | "IO" | "ARM";
export type TriggerKind = "PREPAY" | "SEASONING" | "RATE" | "ARM_RESET" | "ANNIVERSARY";

export interface ClosedLoanFacts {
  loanAmountCents: Cents;
  rateMilli: Milli;
  closingDate: Date;
  product: LoanProduct;
  armFirstResetDate?: Date | null;
  prepayType: Prepay;
  prepayTermMonths: number;
  closingValueCents?: Cents | null;
  ltvAtClosingRatio?: Ratio | null;
}

export interface MoneyListRules {
  prepayWindowDays: number;
  lookbackDays: number;
  seasoningMonths: { purchasePriceCap: number; appraisedValue: number };
  rateDropMilli: Milli;
  armResetWindowDays: number;
  anniversaryWindowDays: number;
  horizonMonths: number;
  refiClosingCostRatio: Ratio;
  appreciationRatioPerYear: Ratio;
  cashOutLtvRatio: Ratio;
  enabled: Record<TriggerKind, boolean>;
}

export const DEFAULT_MONEY_LIST_RULES: MoneyListRules = {
  prepayWindowDays: 60,
  lookbackDays: 120,
  seasoningMonths: { purchasePriceCap: 6, appraisedValue: 12 },
  rateDropMilli: 750,
  armResetWindowDays: 183,
  anniversaryWindowDays: 30,
  horizonMonths: 60,
  refiClosingCostRatio: 300,
  appreciationRatioPerYear: 300,
  cashOutLtvRatio: 7_500,
  enabled: { PREPAY: true, SEASONING: true, RATE: true, ARM_RESET: true, ANNIVERSARY: true },
};

export type PrepayStatus =
  | { state: "NONE" }
  | { state: "EXPIRED"; expiredOn: Date; daysAgo: number }
  | { state: "EXPIRING"; expiresOn: Date; inDays: number; penaltyTodayCents: Cents; penaltyRatio: Ratio }
  | { state: "ACTIVE"; expiresOn: Date; inDays: number; penaltyTodayCents: Cents; penaltyRatio: Ratio };

export interface Trigger {
  kind: TriggerKind;
  /** Days until the event (negative = already happened). */
  days: number;
  date: Date | null;
  detail?: { months?: number; valueBasis?: "PURCHASE_PRICE" | "APPRAISED"; rateDeltaMilli?: Milli };
}

export interface LoanEvaluation {
  monthsSinceClosing: number;
  balanceCents: Cents;
  prepay: PrepayStatus;
  rateDeltaMilli: Milli | null;
  currentPaymentCents: Cents;
  newPaymentCents: Cents | null;
  monthlySavingsCents: Cents;
  refiCostsCents: Cents;
  /** savings × horizon − penalty today − closing costs. */
  netRefiBenefitCents: Cents;
  breakevenMonth: number | null;
  estimatedValueCents: Cents;
  cashOutAvailableCents: Cents;
  /** Prepayment penalty if paid off this month (0 when expired or none). */
  penaltyTodayCents: Cents;
  /** Estimated closing costs of a cash-out refinance on balance + cash out. */
  cashOutCostsCents: Cents;
  /** Cash out minus penalty and closing costs (0 if none available). */
  cashOutNetCents: Cents;
  /** max(refi net benefit, cash-out net of penalty and costs when a seasoning trigger fired). Used for ranking. */
  estimatedBenefitCents: Cents;
  /** Which estimate drives the benefit; NONE = no dollar estimate (review / check-in). */
  benefitKind: "SAVINGS" | "CASH_OUT" | "NONE";
  triggers: Trigger[];
  /** Smallest |days| among triggers, for tie-breaking by urgency. */
  urgencyDays: number;
}

const DAY = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export const daysBetween = (a: Date, b: Date) => Math.round((utcDay(b) - utcDay(a)) / DAY);

export function addMonths(d: Date, months: number): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(d.getUTCDate(), last));
  return r;
}

/** Whole months elapsed from a to b. */
export function monthsBetween(a: Date, b: Date): number {
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return m;
}

const engineProduct = (p: LoanProduct) => (p === "IO" ? "IO30" : p === "ARM" ? "ARM5_6" : "FIXED30") as "IO30" | "ARM5_6" | "FIXED30";

export function evaluateClosedLoan(loan: ClosedLoanFacts, rules: MoneyListRules, marketRateMilli: Milli | null, asOf: Date = new Date()): LoanEvaluation {
  const months = Math.max(0, monthsBetween(loan.closingDate, asOf));
  const product = engineProduct(loan.product);
  const balance = balanceAfter(product, loan.loanAmountCents, loan.rateMilli, months);
  const triggers: Trigger[] = [];

  // Prepay status.
  let prepay: PrepayStatus = { state: "NONE" };
  if (loan.prepayType !== "NONE" && loan.prepayTermMonths > 0) {
    const expiresOn = addMonths(loan.closingDate, loan.prepayTermMonths);
    const inDays = daysBetween(asOf, expiresOn);
    const month = months + 1;
    const ratio = month > loan.prepayTermMonths ? 0 : prepayPenaltyRatio(loan.prepayType, month);
    const penalty = month > loan.prepayTermMonths ? 0 : prepayPenaltyCents(loan.prepayType, balance, month);
    if (inDays <= 0) prepay = { state: "EXPIRED", expiredOn: expiresOn, daysAgo: -inDays };
    else if (inDays <= rules.prepayWindowDays) prepay = { state: "EXPIRING", expiresOn, inDays, penaltyTodayCents: penalty, penaltyRatio: ratio };
    else prepay = { state: "ACTIVE", expiresOn, inDays, penaltyTodayCents: penalty, penaltyRatio: ratio };
    if (rules.enabled.PREPAY && (prepay.state === "EXPIRING" || (prepay.state === "EXPIRED" && prepay.daysAgo <= rules.lookbackDays))) {
      triggers.push({ kind: "PREPAY", days: inDays, date: expiresOn });
    }
  }
  const penaltyToday = prepay.state === "EXPIRING" || prepay.state === "ACTIVE" ? prepay.penaltyTodayCents : 0;

  // Seasoning milestones (the most recent one reached within the lookback window).
  if (rules.enabled.SEASONING) {
    for (const [m, basis] of [
      [rules.seasoningMonths.appraisedValue, "APPRAISED"],
      [rules.seasoningMonths.purchasePriceCap, "PURCHASE_PRICE"],
    ] as const) {
      const date = addMonths(loan.closingDate, m);
      const d = daysBetween(asOf, date);
      if (d <= 0 && -d <= rules.lookbackDays) {
        triggers.push({ kind: "SEASONING", days: d, date, detail: { months: m, valueBasis: basis } });
        break;
      }
    }
  }

  // Refi math at the broker's market rate.
  const currentPayment = loan.product === "IO" ? interestOnlyPayment(loan.loanAmountCents, loan.rateMilli) : amortizingPayment(loan.loanAmountCents, loan.rateMilli, 360);
  let newPayment: Cents | null = null;
  let savings = 0;
  let rateDelta: Milli | null = null;
  if (marketRateMilli !== null) {
    rateDelta = loan.rateMilli - marketRateMilli;
    newPayment = loan.product === "IO" ? interestOnlyPayment(balance, marketRateMilli) : amortizingPayment(balance, marketRateMilli, 360);
    savings = Math.max(0, currentPayment - newPayment);
    if (rules.enabled.RATE && rateDelta >= rules.rateDropMilli) triggers.push({ kind: "RATE", days: 0, date: null, detail: { rateDeltaMilli: rateDelta } });
  }
  const refiCosts = applyRatio(balance, rules.refiClosingCostRatio);
  const netRefi = savings * rules.horizonMonths - penaltyToday - refiCosts;
  const breakeven = savings > 0 ? Math.ceil((penaltyToday + refiCosts) / savings) : null;

  // ARM first reset.
  if (rules.enabled.ARM_RESET && loan.product === "ARM" && loan.armFirstResetDate) {
    const d = daysBetween(asOf, loan.armFirstResetDate);
    if (d >= 0 && d <= rules.armResetWindowDays) triggers.push({ kind: "ARM_RESET", days: d, date: loan.armFirstResetDate });
  }

  // Loan anniversary (portfolio check-in): within the next N days or the past 14.
  if (rules.enabled.ANNIVERSARY && months >= 11) {
    const years = Math.round(months / 12);
    const ann = addMonths(loan.closingDate, years * 12);
    const d = daysBetween(asOf, ann);
    if (d >= -14 && d <= rules.anniversaryWindowDays) triggers.push({ kind: "ANNIVERSARY", days: d, date: ann, detail: { months: years * 12 } });
  }

  // Cash-out estimate: value at closing (given, or implied by LTV, else 75% LTV), appreciated after full seasoning.
  const closingValue = loan.closingValueCents ?? (loan.ltvAtClosingRatio ? roundHalfUp((loan.loanAmountCents * 10_000) / loan.ltvAtClosingRatio) : roundHalfUp((loan.loanAmountCents * 10_000) / 7_500));
  const value =
    months >= rules.seasoningMonths.appraisedValue
      ? roundHalfUp(closingValue * Math.pow(1 + rules.appreciationRatioPerYear / 10_000, months / 12))
      : closingValue;
  const cashOut = months >= rules.seasoningMonths.purchasePriceCap ? Math.max(0, applyRatio(value, rules.cashOutLtvRatio) - balance) : 0;
  const cashOutCosts = cashOut > 0 ? applyRatio(balance + cashOut, rules.refiClosingCostRatio) : 0;
  const cashOutNet = cashOut > 0 ? Math.max(0, cashOut - penaltyToday - cashOutCosts) : 0;
  // Cash out is a benefit only when seasoning is the reason to call; otherwise equity alone would rank every old loan first.
  const seasoned = triggers.some((t) => t.kind === "SEASONING");
  const benefit = Math.max(netRefi, seasoned ? cashOutNet : 0, 0);

  return {
    monthsSinceClosing: months,
    balanceCents: balance,
    prepay,
    rateDeltaMilli: rateDelta,
    currentPaymentCents: currentPayment,
    newPaymentCents: newPayment,
    monthlySavingsCents: savings,
    refiCostsCents: refiCosts,
    netRefiBenefitCents: netRefi,
    breakevenMonth: breakeven,
    estimatedValueCents: value,
    cashOutAvailableCents: cashOut,
    penaltyTodayCents: penaltyToday,
    cashOutCostsCents: cashOutCosts,
    cashOutNetCents: cashOutNet,
    estimatedBenefitCents: benefit,
    benefitKind: benefit <= 0 ? "NONE" : netRefi >= benefit ? "SAVINGS" : "CASH_OUT",
    triggers,
    urgencyDays: triggers.length ? Math.min(...triggers.map((t) => Math.abs(t.days))) : Infinity,
  };
}

/** Rank by estimated net benefit to the client, then by urgency. */
export function rankMoneyList<T extends { evaluation: LoanEvaluation }>(rows: T[]): T[] {
  return rows
    .filter((r) => r.evaluation.triggers.length > 0)
    .sort((a, b) => b.evaluation.estimatedBenefitCents - a.evaluation.estimatedBenefitCents || a.evaluation.urgencyDays - b.evaluation.urgencyDays);
}

/** Totals for the Money List header (dollar estimates only; review/check-in rows are counted, not summed). */
export function summarizeMoneyList(evals: LoanEvaluation[]): { count: number; withDollarEstimate: number; totalBenefitCents: Cents } {
  const dollar = evals.filter((e) => e.benefitKind !== "NONE");
  return { count: evals.length, withDollarEstimate: dollar.length, totalBenefitCents: dollar.reduce((s, e) => s + e.estimatedBenefitCents, 0) };
}
