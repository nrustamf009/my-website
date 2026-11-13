import type { Broker, ClosedLoan } from "@prisma/client";
import type { ScopedDb } from "@/lib/db";
import { evaluateClosedLoan, rankMoneyList, type LoanEvaluation, type LoanProduct, type Prepay } from "@/lib/dscr";
import { moneyListRules } from "@/lib/broker";

export interface MoneyListRow {
  loan: ClosedLoan;
  evaluation: LoanEvaluation;
}

export const ACTIVE_STATUSES = ["OPEN", "SNOOZED"];

function toFacts(l: ClosedLoan) {
  return {
    loanAmountCents: l.loanAmountCents,
    rateMilli: l.rateMilli,
    closingDate: l.closingDate,
    product: l.product as LoanProduct,
    armFirstResetDate: l.armFirstResetDate,
    prepayType: l.prepayType as Prepay,
    prepayTermMonths: l.prepayTermMonths,
    closingValueCents: l.closingValueCents,
    ltvAtClosingRatio: l.ltvAtClosingRatio,
  };
}

export function evaluateLoan(l: ClosedLoan, broker: Pick<Broker, "moneyListRules" | "marketRateMilli" | "whatIfRateMilli">, opts: { whatIf?: boolean; asOf?: Date } = {}) {
  const rate = opts.whatIf && broker.whatIfRateMilli ? broker.whatIfRateMilli : broker.marketRateMilli;
  return evaluateClosedLoan(toFacts(l), moneyListRules(broker), rate ?? null, opts.asOf);
}

/** Ranked opportunities (snoozed-until-future, contacted, not-interested and won excluded). */
export async function buildMoneyList(db: ScopedDb, broker: Broker, opts: { whatIf?: boolean } = {}) {
  const now = new Date();
  const loans = await db.closedLoan.findMany();
  const active = loans.filter((l) => l.status === "OPEN" || (l.status === "SNOOZED" && (!l.snoozedUntil || l.snoozedUntil <= now)));
  const rows = rankMoneyList(active.map((loan) => ({ loan, evaluation: evaluateLoan(loan, broker, opts) })));
  return { rows, total: loans.length, loans };
}
