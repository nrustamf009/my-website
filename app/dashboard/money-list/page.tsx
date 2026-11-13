import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features, moneyListRules } from "@/lib/broker";
import { buildMoneyList, evaluateLoan } from "@/lib/moneylist/list";
import { describeOpportunity, triggerShort } from "@/lib/moneylist/describe";
import { parseRateToMilli, pct, rate, relativeTime, shortDate, usd } from "@/lib/format";
import { summarizeMoneyList, type TriggerKind } from "@/lib/dscr";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat, cx } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, TRIGGER_NAME, TRIGGER_TONE } from "@/components/moneylist/labels";
import { MarketRateForm, DigestButton } from "@/components/moneylist/Controls";

export const metadata = { title: "Money List" };

const KINDS: TriggerKind[] = ["PREPAY", "SEASONING", "RATE", "ARM_RESET", "ANNIVERSARY"];

export default async function MoneyListPage({ searchParams }: { searchParams: Promise<{ t?: string; rate?: string; view?: string }> }) {
  const { broker, db, canManage } = await requireBroker();
  if (!features(broker).moneyList) redirect("/dashboard");
  const sp = await searchParams;
  const whatIf = sp.rate ? parseRateToMilli(sp.rate) : null;
  const whatIfValid = whatIf != null && whatIf >= 2_000 && whatIf <= 15_000 ? whatIf : null;
  const { rows, total, loans } = await buildMoneyList(db, broker, { rateMilli: whatIfValid });
  const horizon = moneyListRules(broker).horizonMonths;
  const filter = KINDS.includes(sp.t as TriggerKind) ? (sp.t as TriggerKind) : null;
  const shown = filter ? rows.filter((r) => r.evaluation.triggers.some((x) => x.kind === filter)) : rows;
  const counts = Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.evaluation.triggers.some((x) => x.kind === k)).length]));
  const summary = summarizeMoneyList(rows.map((r) => r.evaluation));
  const contacted30 = loans.filter((l) => l.status === "CONTACTED" && l.updatedAt > new Date(Date.now() - 30 * 86_400_000)).length;
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { t: filter, rate: whatIfValid ? sp.rate! : null, view: sp.view ?? null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  if (!total) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Money List" subtitle="Your closed loans, re-checked every day for prepay expirations, seasoning milestones, rate drops and ARM resets." />
        <EmptyState
          title="Import your closed loans"
          body="Upload a CSV from your LOS (or start from our template). We'll rank past clients by how much a call could save them, and draft the email and text for you."
          action={<div className="flex gap-2"><LinkButton href="/dashboard/money-list/import" variant="accent">Import loans</LinkButton><LinkButton href="/api/money-list/template" variant="secondary" prefetch={false}>Download template</LinkButton></div>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Money List"
        subtitle={`${total} closed loan${total === 1 ? "" : "s"} watched. Ranked by estimated net benefit to the client, then urgency.`}
        actions={
          <>
            <DigestButton />
            <LinkButton href="/dashboard/money-list/import" variant="secondary">Import / add</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Worth a call" value={rows.length} hint={`of ${total} loans`} />
        <Stat label="Est. client benefit" value={usd(summary.totalBenefitCents)} hint={`${summary.withDollarEstimate} with a dollar estimate`} />
        <Stat label="Contacted (30 days)" value={contacted30} />
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Market rate</div>
          <MarketRateForm current={broker.marketRateMilli} canManage={canManage} />
          <form method="get" className="mt-2 flex items-center gap-2 text-xs text-muted">
            {filter && <input type="hidden" name="t" value={filter} />}
            <label htmlFor="whatif">What if</label>
            <input id="whatif" name="rate" defaultValue={sp.rate ?? ""} placeholder="6.50" inputMode="decimal" className="h-7 w-16 rounded-md border border-line bg-white px-2 text-ink" />
            <span>%</span>
            <button className="rounded-md px-1.5 py-0.5 text-accent hover:bg-accent-soft" type="submit">Try</button>
          </form>
        </div>
      </div>

      {whatIfValid && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-accent-deep" data-testid="whatif-banner">
          <span>What-if: showing results at a market rate of <b>{rate(whatIfValid)}</b> (not saved).</span>
          <Link href={qs({ rate: null })} className="font-medium underline">Back to {rate(broker.marketRateMilli)}</Link>
        </div>
      )}

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by trigger">
        <Link href={qs({ t: null, view: null })} className={chip(!filter && sp.view !== "all")}>All opportunities <span className="num opacity-70">{rows.length}</span></Link>
        {KINDS.map((k) => (
          <Link key={k} href={qs({ t: k, view: null })} className={chip(filter === k)} aria-disabled={!counts[k]}>
            {TRIGGER_NAME[k]} <span className="num opacity-70">{counts[k]}</span>
          </Link>
        ))}
        <Link href={qs({ t: null, view: "all" })} className={chip(sp.view === "all")}>All loans <span className="num opacity-70">{total}</span></Link>
      </div>

      {sp.view === "all" ? (
        <Card className="mt-3 overflow-hidden">
          <ul className="divide-y divide-line" data-testid="all-loans">
            {loans.map((l) => {
              const ev = evaluateLoan(l, broker, { rateMilli: whatIfValid });
              return (
                <li key={l.id}>
                  <Link href={`/dashboard/money-list/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/60">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{l.borrowerName}</div>
                      <div className="truncate text-xs text-muted">{l.propertyAddress} · closed {shortDate(l.closingDate)} · {usd(l.loanAmountCents)} at {rate(l.rateMilli)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {ev.triggers.length > 0 && <span className="hidden text-xs text-muted sm:inline">{ev.triggers.map(triggerShort).join(" · ")}</span>}
                      <Badge tone={STATUS_TONE[l.status]}>{l.status === "SNOOZED" && l.snoozedUntil ? `Snoozed to ${shortDate(l.snoozedUntil)}` : STATUS_LABEL[l.status]}</Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : shown.length === 0 ? (
        <div className="mt-3"><EmptyState title={filter ? `No ${TRIGGER_NAME[filter].toLowerCase()} opportunities` : "No one to call right now"} body="We re-check every loan daily. Try a what-if rate to see who a rate drop would help." /></div>
      ) : (
        <ol className="mt-3 space-y-3" data-testid="money-list">
          {shown.map(({ loan, evaluation }, i) => {
            const op = describeOpportunity(evaluation, horizon);
            return (
              <li key={loan.id}>
                <Link href={`/dashboard/money-list/${loan.id}${qs({ t: null, view: null })}`} className="block rounded-2xl border border-line bg-card p-4 transition hover:border-accent/40 hover:shadow-sm sm:p-5" data-testid="ml-row">
                  <div className="flex items-start gap-4">
                    <div className="num hidden w-6 pt-0.5 text-sm text-muted sm:block">{i + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{loan.borrowerName}</span>
                        {evaluation.triggers.map((x) => (
                          <Badge key={x.kind} tone={TRIGGER_TONE[x.kind]}>{triggerShort(x)}</Badge>
                        ))}
                        {loan.status === "SNOOZED" && <Badge tone="warn">Back from snooze</Badge>}
                      </div>
                      <div className="mt-0.5 truncate text-sm text-muted">{loan.propertyAddress}</div>
                      <p className="mt-2 text-sm text-ink-2">{op.headline}.</p>
                      {op.netOf && <p className="mt-0.5 text-xs text-muted">{op.benefit} ({op.netOf}){evaluation.breakevenMonth && op.kind === "SAVINGS" ? ` · breakeven month ${evaluation.breakevenMonth}` : ""}.</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cx("num font-display text-2xl", op.kind === "NONE" ? "text-ink-2" : "text-good")} data-testid="ml-benefit">{op.benefitLabel}</div>
                      <div className="text-xs text-muted">{op.benefitHint}</div>
                      {loan.draftedAt && <div className="mt-1 text-[11px] text-muted">Draft {relativeTime(loan.draftedAt)}</div>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-6 text-xs text-muted">Estimates use your market rate, today&apos;s balance from the original amortization, {pct(moneyListRules(broker).refiClosingCostRatio)} closing costs and a {horizon}-month horizon. Values for cash-out assume modest appreciation after 12 months. Always confirm with a full application.</p>
    </div>
  );
}

function chip(active: boolean) {
  return cx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition", active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-ink/30");
}
