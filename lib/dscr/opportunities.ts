import type { PrepayType } from "./types";
import { addMonths, daysBetween, monthsBetween, prepayExpiry, prepayPenaltyPct } from "./prepay";
import { cashOutEstimate, rateDropSavings } from "./refi";

export interface MoneyListSettings {
  marketRate: number | null;
  /** Points the client's rate must exceed the market rate by. */
  rateDropThreshold: number;
  /** Flag prepay penalties that end within this many days. */
  prepayWindowDays: number;
  /** Cash-out seasoning milestones in months, e.g. [6, 12]. */
  seasoningMonths: number[];
  /** How far back an expired prepay / reached milestone still counts as "new". */
  lookbackDays: number;
}

export const DEFAULT_LOOKBACK_DAYS = 120;

export interface LoanForRules {
  id: string;
  loanAmount: number;
  ratePct: number;
  closingDate: Date;
  prepayType: string;
  prepayTermYears: number;
  interestOnly: boolean;
}

export type ReasonKind = "PREPAY" | "SEASONING" | "RATE";

export interface Reason {
  kind: ReasonKind;
  label: string;
  detail: string;
}

export interface Opportunity {
  loanId: string;
  reasons: Reason[];
  /** Ranking score, roughly "estimated first-year dollars to the client". */
  score: number;
  benefit: string;
  monthlySavings: number | null;
  cashOut: number | null;
  currentPenaltyPct: number;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function asPrepay(t: string): PrepayType | "OTHER" {
  return t === "5-4-3-2-1" || t === "3-2-1" || t === "NONE" ? t : "OTHER";
}

/** Evaluate one closed loan against the broker's Money List rules. */
export function evaluateLoan(loan: LoanForRules, s: MoneyListSettings, asOf: Date = new Date()): Opportunity | null {
  const reasons: Reason[] = [];
  const monthsPaid = Math.max(0, monthsBetween(loan.closingDate, asOf));
  const type = asPrepay(loan.prepayType);
  const penaltyNow = prepayPenaltyPct(type, loan.closingDate, loan.prepayTermYears, asOf);

  // Rule 1: prepay penalty ended recently or ends within the window.
  const expiry = type === "NONE" ? null : prepayExpiry(loan.closingDate, loan.prepayTermYears);
  let prepayFreeSoon = false;
  if (expiry) {
    const days = daysBetween(asOf, expiry);
    if (days >= 0 && days <= s.prepayWindowDays) {
      prepayFreeSoon = true;
      reasons.push({ kind: "PREPAY", label: "Prepay ends soon", detail: `Prepayment penalty ends ${fmtDate(expiry)} (in ${days} days)` });
    } else if (days < 0 && -days <= s.lookbackDays) {
      prepayFreeSoon = true;
      reasons.push({ kind: "PREPAY", label: "Prepay expired", detail: `Prepayment penalty ended ${fmtDate(expiry)}` });
    }
  }

  // Rule 2: cash-out seasoning milestone reached recently.
  const milestones = [...s.seasoningMonths].sort((a, b) => b - a);
  for (const m of milestones) {
    const date = addMonths(loan.closingDate, m);
    const since = daysBetween(date, asOf);
    if (since >= 0 && since <= s.lookbackDays) {
      reasons.push({ kind: "SEASONING", label: `${m}-month seasoning`, detail: `Reached ${m} months of seasoning on ${fmtDate(date)}; cash-out refinance now possible with many lenders` });
      break;
    }
  }

  // Rule 3: market rate is X+ points below the client's rate.
  let savings: ReturnType<typeof rateDropSavings> | null = null;
  if (s.marketRate != null && loan.ratePct - s.marketRate >= s.rateDropThreshold - 1e-9) {
    savings = rateDropSavings({
      originalLoan: loan.loanAmount,
      currentRatePct: loan.ratePct,
      marketRatePct: s.marketRate,
      monthsPaid,
      interestOnly: loan.interestOnly,
      penaltyPct: prepayFreeSoon ? 0 : penaltyNow,
    });
    reasons.push({
      kind: "RATE",
      label: "Rate drop",
      detail: `Note rate ${loan.ratePct.toFixed(3)}% is ${(loan.ratePct - s.marketRate).toFixed(2)} pts above today's ~${s.marketRate.toFixed(3)}%`,
    });
  }

  if (reasons.length === 0) return null;

  const cash = reasons.some((r) => r.kind === "SEASONING")
    ? cashOutEstimate({ originalLoan: loan.loanAmount, ratePct: loan.ratePct, monthsPaid, interestOnly: loan.interestOnly }).availableCash
    : null;

  const parts: string[] = [];
  if (savings && savings.monthlySavings > 0) {
    parts.push(`About ${usd(savings.monthlySavings)}/mo lower P&I (${usd(savings.annualSavings)}/yr)`);
    if (savings.penaltyCost > 0 && savings.breakevenMonths) parts.push(`${penaltyNow}% prepay ≈ ${usd(savings.penaltyCost)}, breakeven ~${Math.ceil(savings.breakevenMonths)} mo`);
  }
  if (cash && cash > 1000) parts.push(`Est. ${usd(cash)} cash-out available`);
  if (parts.length === 0 && prepayFreeSoon) parts.push("Free to refinance or sell without a prepayment penalty");

  const netSavings = savings ? savings.annualSavings - savings.penaltyCost : 0;
  const score = Math.max(0, netSavings) + (cash ?? 0) * 0.15 + (prepayFreeSoon ? 1500 : 0) + reasons.length * 500;

  return {
    loanId: loan.id,
    reasons,
    score,
    benefit: parts.join(" · "),
    monthlySavings: savings?.monthlySavings ?? null,
    cashOut: cash,
    currentPenaltyPct: penaltyNow,
  };
}

export function evaluateAll<T extends LoanForRules>(loans: T[], s: MoneyListSettings, asOf = new Date()) {
  return loans
    .map((loan) => ({ loan, opp: evaluateLoan(loan, s, asOf) }))
    .filter((x): x is { loan: T; opp: Opportunity } => x.opp !== null)
    .sort((a, b) => b.opp.score - a.opp.score);
}

export function settingsFromBroker(b: { marketRate: number | null; rateDropThreshold: number; prepayWindowDays: number; seasoningMonths: string }): MoneyListSettings {
  let seasoning: number[] = [6, 12];
  try {
    const parsed = JSON.parse(b.seasoningMonths);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) seasoning = parsed;
  } catch {
    /* keep default */
  }
  return { marketRate: b.marketRate, rateDropThreshold: b.rateDropThreshold, prepayWindowDays: b.prepayWindowDays, seasoningMonths: seasoning, lookbackDays: DEFAULT_LOOKBACK_DAYS };
}
