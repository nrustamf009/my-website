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

/**
 * The Money List board (DESIGN.md §7.4): every loan with a trigger that is still in play
 * (open, snoozed or contacted), ranked by estimated benefit. Not-interested and won loans drop off.
 */
export async function buildMoneyBoard(db: ScopedDb, broker: Broker, opts: ListOpts = {}) {
  const loans = await db.closedLoan.findMany({ orderBy: { closingDate: "desc" } });
  const live = loans.filter((l) => l.status === "OPEN" || l.status === "SNOOZED" || l.status === "CONTACTED");
  const rows = rankMoneyList(live.map((loan) => ({ loan, evaluation: evaluateLoan(loan, broker, opts) })));
  const now = new Date();
  return {
    rows,
    total: loans.length,
    loans,
    notContacted: rows.filter((r) => isActive(r.loan, now)).length,
    contacted: rows.filter((r) => r.loan.status === "CONTACTED").length,
    snoozed: rows.filter((r) => r.loan.status === "SNOOZED" && !isActive(r.loan, now)).length,
  };
}
