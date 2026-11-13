import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features, moneyListRules, parseJson } from "@/lib/broker";
import { evaluateLoan } from "@/lib/moneylist/list";
import { describeOpportunity, triggerShort } from "@/lib/moneylist/describe";
import { dateTime, pct, rate, shortDate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import type { Prepay } from "@/lib/dscr";
import { Badge, Card, CardHeader, cx } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, TRIGGER_TONE } from "@/components/moneylist/labels";
import { DraftPanel, NotesForm, StatusActions, type Draft } from "@/components/moneylist/LoanActions";

export const metadata = { title: "Money List · Loan" };

const PRODUCT: Record<string, string> = { FIXED: "30-year fixed", IO: "Interest-only", ARM: "ARM" };

function Row({ label, value, strong, hint }: { label: string; value: React.ReactNode; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}{hint && <span className="block text-xs">{hint}</span>}</dt>
      <dd className={cx("num text-right", strong ? "font-semibold text-ink" : "text-ink-2")}>{value}</dd>
    </div>
  );
}

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { broker, db } = await requireBroker();
  if (!features(broker).moneyList) redirect("/dashboard");
  const { id } = await params;
  const loan = await db.closedLoan.findFirst({ where: { id }, include: { history: { orderBy: { createdAt: "desc" } } } });
  if (!loan) notFound();
  const users = await db.user.findMany({ select: { id: true, name: true, email: true } });
  const who = (uid: string | null) => (uid ? (users.find((u) => u.id === uid)?.name ?? "Teammate") : "System");
  const ev = evaluateLoan(loan, broker);
  const horizon = moneyListRules(broker).horizonMonths;
  const op = describeOpportunity(ev, horizon);
  const d = parseJson<{ subject: string; body: string } | null>(loan.draftEmail, null);
  const draft: Draft | null = d && loan.draftSms ? { subject: d.subject, email: d.body, sms: loan.draftSms } : null;
  const p = ev.prepay;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/money-list" className="text-sm text-muted hover:text-ink">← Money List</Link>
      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl tracking-tight text-ink">{loan.borrowerName}</h1>
            <Badge tone={STATUS_TONE[loan.status]}>{loan.status === "SNOOZED" && loan.snoozedUntil ? `Snoozed to ${shortDate(loan.snoozedUntil)}` : STATUS_LABEL[loan.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{loan.propertyAddress}</p>
          <p className="mt-1 text-sm text-muted">{[loan.email, loan.phone].filter(Boolean).join(" · ") || "No contact details on file"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-5 py-3 text-right">
          <div className={cx("num font-display text-3xl", op.kind === "NONE" ? "text-ink-2" : "text-good")} data-testid="loan-benefit">{op.benefitLabel}</div>
          <div className="text-xs text-muted">{op.benefitHint}</div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="lg:col-start-1 lg:row-start-1">
          <Card>
            <CardHeader title="Why now" />
            <div className="px-5 pb-5">
              {ev.triggers.length ? (
                <ul className="space-y-2">
                  {op.reasons.map((r, i) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-ink-2">
                      <Badge tone={TRIGGER_TONE[ev.triggers[i]!.kind]} className="mt-0.5 shrink-0">{triggerShort(ev.triggers[i]!)}</Badge>
                      <span>{r}.</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No trigger right now. We&apos;ll surface this loan when the prepay window, seasoning, an ARM reset or a rate drop makes a call worthwhile.</p>
              )}
              {op.benefit && <p className="mt-3 rounded-xl bg-good-soft px-3 py-2 text-sm text-good">{op.benefit} ({op.netOf}).</p>}
            </div>
          </Card>
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <Card>
            <CardHeader title="The numbers" subtitle={`Market rate ${rate(broker.marketRateMilli)} · ${horizon}-month horizon`} />
            <dl className="divide-y divide-line px-5 pb-4">
              <Row label="Original loan" value={`${usd(loan.loanAmountCents)} at ${rate(loan.rateMilli)}`} />
              <Row label="Product" value={PRODUCT[loan.product] ?? loan.product} hint={loan.product === "ARM" && loan.armFirstResetDate ? `First reset ${shortDate(loan.armFirstResetDate)}` : undefined} />
              <Row label="Closed" value={`${shortDate(loan.closingDate)} (${ev.monthsSinceClosing} months ago)`} />
              <Row label="Estimated balance today" value={usd(ev.balanceCents)} />
              <Row label="Prepayment penalty" value={p.state === "NONE" ? "None" : p.state === "EXPIRED" ? `Ended ${shortDate(p.expiredOn)}` : `${usd(p.penaltyTodayCents)} today · ends ${shortDate(p.expiresOn)}`} hint={t.prepay[loan.prepayType as Prepay]} />
              <Row label="Current payment (P&I)" value={`${usd(ev.currentPaymentCents)}/mo`} />
              <Row label="At market rate" value={ev.newPaymentCents != null ? `${usd(ev.newPaymentCents)}/mo` : "Set a market rate"} />
              <Row label="Monthly savings" value={`${usd(ev.monthlySavingsCents)}/mo`} strong={ev.monthlySavingsCents > 0} />
              <Row label="Refi closing costs (est.)" value={usd(ev.refiCostsCents)} />
              <Row label="Breakeven" value={ev.breakevenMonth ? `Month ${ev.breakevenMonth}` : "—"} />
              <Row label="Net refi benefit" value={usd(ev.netRefiBenefitCents)} strong />
              <Row label="Estimated value" value={usd(ev.estimatedValueCents)} hint={loan.closingValueCents ? "From value at closing" : loan.ltvAtClosingRatio ? `Implied by ${pct(loan.ltvAtClosingRatio)} LTV` : "Assumes 75% LTV at closing"} />
              <Row label="Cash-out available (est.)" value={usd(ev.cashOutAvailableCents)} />
              <Row label="Cash out, net of costs" value={usd(ev.cashOutNetCents)} strong={ev.benefitKind === "CASH_OUT"} />
            </dl>
          </Card>
        </div>

        <div className="space-y-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <DraftPanel loanId={loan.id} initial={draft} hasEmail={!!loan.email} hasPhone={!!loan.phone} />
          <Card>
            <CardHeader title="Log what happened" />
            <div className="px-5 pb-5"><StatusActions loanId={loan.id} status={loan.status} /></div>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <div className="px-5 pb-5"><NotesForm loanId={loan.id} initial={loan.notes ?? ""} /></div>
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="space-y-2 px-5 pb-5 text-sm" data-testid="loan-history">
              {loan.history.map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-ink-2">{STATUS_LABEL[h.toState] ?? h.toState}{h.note ? <span className="text-muted"> · {h.note}</span> : null}</span>
                  <span className="shrink-0 text-xs text-muted">{who(h.userId)} · {dateTime(h.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
