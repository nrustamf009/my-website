import type { Broker, ClosedLoan } from "@prisma/client";
import type { ScopedDb } from "@/lib/db";
import { evaluateClosedLoan, rankMoneyList, type LoanEvaluation, type LoanProduct, type Prepay } from "@/lib/dscr";
import { moneyListRules } from "@/lib/broker";

export interface MoneyListRow {
  loan: ClosedLoan;
  evaluation: LoanEvaluation;
}


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

export interface ListOpts {
  /** What-if market rate (milli-percent) from the URL; overrides the broker's market rate. */
  rateMilli?: number | null;
  asOf?: Date;
}

export function evaluateLoan(l: ClosedLoan, broker: Pick<Broker, "moneyListRules" | "marketRateMilli">, opts: ListOpts = {}) {
  return evaluateClosedLoan(toFacts(l), moneyListRules(broker), opts.rateMilli ?? broker.marketRateMilli ?? null, opts.asOf);
}

export const isActive = (l: Pick<ClosedLoan, "status" | "snoozedUntil">, now = new Date()) => l.status === "OPEN" || (l.status === "SNOOZED" && (!l.snoozedUntil || l.snoozedUntil <= now));

/** Ranked opportunities (snoozed-until-future, contacted, not-interested and won excluded). */
export async function buildMoneyList(db: ScopedDb, broker: Broker, opts: ListOpts = {}) {
  const now = new Date();
  const loans = await db.closedLoan.findMany({ orderBy: { closingDate: "desc" } });
  const active = loans.filter((l) => isActive(l, now));
  const rows = rankMoneyList(active.map((loan) => ({ loan, evaluation: evaluateLoan(loan, broker, opts) })));
  return { rows, total: loans.length, loans };
}
