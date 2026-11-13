import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features, moneyListRules, parseJson } from "@/lib/broker";
import { buildMoneyBoard } from "@/lib/moneylist/list";
import { describeOpportunity, triggerShort } from "@/lib/moneylist/describe";
import { parseRateToMilli, pct, rate, shortDate, usd } from "@/lib/format";
import { summarizeMoneyList, type TriggerKind } from "@/lib/dscr";
import { EmptyState, LinkButton, cx } from "@/components/ui";
import { Eyebrow } from "@design/components/primitives";
import { TRIGGER_NAME } from "@/components/moneylist/labels";
import { MarketRateForm, DigestButton } from "@/components/moneylist/Controls";
import { DraftPanel, StatusActions, type Draft } from "@/components/moneylist/LoanActions";

export const metadata = { title: "Money List" };

const KINDS: TriggerKind[] = ["PREPAY", "SEASONING", "RATE", "ARM_RESET", "ANNIVERSARY"];
const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const PRODUCT: Record<string, string> = { FIXED: "", IO: " · IO", ARM: " · ARM" };

export default async function MoneyListPage({ searchParams }: { searchParams: Promise<{ t?: string; rate?: string; view?: string; loan?: string }> }) {
  const { broker, db, canManage } = await requireBroker();
  if (!features(broker).moneyList) redirect("/dashboard");
  const sp = await searchParams;
  const whatIf = sp.rate ? parseRateToMilli(sp.rate) : null;
  const whatIfValid = whatIf != null && whatIf >= 2_000 && whatIf <= 15_000 ? whatIf : null;
  const board = await buildMoneyBoard(db, broker, { rateMilli: whatIfValid });
  const { rows, total } = board;
  const rules = moneyListRules(broker);
  const horizon = rules.horizonMonths;
  const filter = KINDS.includes(sp.t as TriggerKind) ? (sp.t as TriggerKind) : null;
  const shown = filter ? rows.filter((r) => r.evaluation.triggers.some((x) => x.kind === filter)) : rows;
  const counts = Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.evaluation.triggers.some((x) => x.kind === k)).length]));
  const summary = summarizeMoneyList(rows.map((r) => r.evaluation));
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { t: filter, rate: whatIfValid ? sp.rate! : null, view: sp.view ?? null, loan: sp.loan ?? null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const selected = shown.find((r) => r.loan.id === sp.loan) ?? shown[0] ?? null;
  const selDraft = selected ? parseJson<{ subject: string; body: string } | null>(selected.loan.draftEmail, null) : null;
  const draft: Draft | null = selected && selDraft && selected.loan.draftSms ? { subject: selDraft.subject, email: selDraft.body, sms: selected.loan.draftSms } : null;
  const statusText = (l: (typeof rows)[number]["loan"]) =>
    l.status === "CONTACTED" ? `Contacted ${shortDate(l.updatedAt)}` : l.status === "SNOOZED" && l.snoozedUntil && l.snoozedUntil > new Date() ? `Snoozed to ${shortDate(l.snoozedUntil)}` : "Not contacted";

  if (!total) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="type-h1 text-ink">Money List</h1>
        <p className="mb-6 mt-2 max-w-2xl text-ink-2">Your closed loans, re-checked every day for prepay expirations, seasoning milestones, rate drops and ARM resets.</p>
        <EmptyState
          title="Import your closed loans"
          body="Upload a CSV from your LOS (or start from our template). We'll rank past clients by how much a call could save them, and draft the email and text for you."
          action={<div className="flex gap-2"><LinkButton href="/dashboard/money-list/import" variant="accent">Import loans</LinkButton><LinkButton href="/api/money-list/template" variant="secondary" prefetch={false}>Download template</LinkButton></div>}
        />
      </div>
    );
  }

  const count = rows.length;
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-end gap-5">
          <span className="type-dashboard-count num text-accent [display:var(--dashboard-count-display)]" aria-hidden>{count}</span>
          <div>
            <Eyebrow>Money List · {shortDate(new Date())}</Eyebrow>
            <h1 className="type-h1 mt-1 text-ink" style={{ textWrap: "balance" }}>{`${count < NUMBER_WORDS.length ? NUMBER_WORDS[count] : count} client${count === 1 ? "" : "s"} worth a call`}</h1>
            <p className="mt-2 text-ink-2">Found among your {total} closed loans, ranked by estimated benefit to the client. {board.notContacted} not contacted · {board.contacted} contacted · {board.snoozed} snoozed. {usd(summary.totalBenefitCents)} in estimated benefit.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="border border-rule bg-surface px-4 py-2">
            <div className="type-body-small text-muted">Market rate, set by you</div>
            <MarketRateForm current={broker.marketRateMilli} canManage={canManage} />
          </div>
          <div className="flex flex-col justify-center gap-2">
            <DigestButton />
            <LinkButton href="/dashboard/money-list/import" variant="ghost" size="sm">Import / add</LinkButton>
          </div>
        </div>
      </div>

      <form method="get" className="mt-4 flex items-center gap-2 text-sm text-muted">
        {filter && <input type="hidden" name="t" value={filter} />}
        <label htmlFor="whatif">What if the market rate were</label>
        <input id="whatif" name="rate" defaultValue={sp.rate ?? ""} placeholder="6.50" inputMode="decimal" className="h-9 w-20 rounded-[var(--radius-control)] border border-rule bg-surface px-2 text-ink" />
        <span>%</span>
        <button className="rounded-[var(--radius-control)] border border-rule px-3 py-1.5 text-ink hover:bg-surface" type="submit">Try</button>
      </form>
      {whatIfValid && (
        <div className="mt-3 flex items-center justify-between border border-rule bg-accent-tint px-4 py-2.5 text-sm text-ink" data-testid="whatif-banner">
          <span>What-if: showing results at a market rate of <b>{rate(whatIfValid)}</b> (not saved).</span>
          <Link href={qs({ rate: null })} className="font-medium underline">Back to {rate(broker.marketRateMilli)}</Link>
        </div>
      )}

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by trigger">
        <Link href={qs({ t: null, loan: null })} aria-current={!filter ? "true" : undefined} className={chip(!filter)}>All reasons <span className="num opacity-70">{rows.length}</span></Link>
        {KINDS.map((k) => (
          <Link key={k} href={qs({ t: k, loan: null })} aria-current={filter === k ? "true" : undefined} className={chip(filter === k)}>
            {TRIGGER_NAME[k]} <span className="num opacity-70">{counts[k]}</span>
          </Link>
        ))}
        <Link href="/dashboard/money-list/all" className={chip(false)}>All loans <span className="num opacity-70">{total}</span></Link>
      </nav>

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {shown.length === 0 ? (
            <EmptyState title={filter ? `No ${TRIGGER_NAME[filter].toLowerCase()} opportunities` : "No one to call right now"} body="We re-check every loan daily. Try a what-if rate to see who a rate drop would help." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm" data-testid="money-list">
                <thead>
                  <tr className="border-b-[length:var(--border-strong)] border-rule-strong text-left">
                    {["Client", "Loan today", "Why now", "Est. benefit", "Status", ""].map((h, i) => (
                      <th key={i} scope="col" className={cx("type-eyebrow px-3 pb-2 font-normal text-muted", h === "Est. benefit" && "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ loan, evaluation }) => {
                    const op = describeOpportunity(evaluation, horizon);
                    const on = selected?.loan.id === loan.id;
                    return (
                      <tr key={loan.id} className={cx("border-b border-rule align-top", on ? "bg-surface" : "")} data-testid="ml-row">
                        <td className="px-3 py-3">
                          <Link href={`/dashboard/money-list/${loan.id}`} className="font-semibold text-ink hover:underline">{loan.borrowerName}</Link>
                          <div className="type-body-small text-muted">{loan.propertyAddress}</div>
                        </td>
                        <td className="num px-3 py-3 text-ink">
                          {rate(loan.rateMilli)}{PRODUCT[loan.product]}
                          <div className="type-body-small text-muted">{usd(evaluation.balanceCents)} balance</div>
                        </td>
                        <td className="px-3 py-3 text-ink">
                          {op.headline}
                          <div className="type-body-small text-muted">{evaluation.triggers.map(triggerShort).join(" · ")}</div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className={cx("type-metric-panel num", op.kind === "NONE" ? "text-ink [font-style:var(--type-option-letter-style)]" : "text-accent")} data-testid="ml-benefit">{op.benefitLabel}</div>
                          <div className="type-body-small text-muted">{op.benefitHint}</div>
                        </td>
                        <td className="px-3 py-3 text-ink-2">{statusText(loan)}</td>
                        <td className="hidden px-3 py-3 xl:table-cell">
                          <Link href={qs({ loan: loan.id })} aria-label={`Draft for ${loan.borrowerName}`} className={cx("text-sm underline underline-offset-4", on ? "text-ink" : "text-muted")}>Draft</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="type-body-small mt-3 text-muted">Showing {shown.length} of {rows.length}. Benefit is estimated savings over {horizon} months less closing costs ({pct(rules.refiClosingCostRatio)}) and any prepayment charge still owed; cash-out rows show cash in reach after costs. Review rows have no dollar figure.</p>
        </div>

        {selected && (
          <aside className="hidden h-fit border border-rule bg-surface-alt p-5 xl:sticky xl:top-6 xl:block" aria-label="Draft message">
            <Eyebrow className="text-accent">Draft message</Eyebrow>
            <h2 className="type-section mt-1 text-ink">To {selected.loan.borrowerName}</h2>
            <div className="mt-4"><DraftPanel key={selected.loan.id} loanId={selected.loan.id} initial={draft} hasEmail={!!selected.loan.email} hasPhone={!!selected.loan.phone} /></div>
            <div className="mt-4"><StatusActions loanId={selected.loan.id} status={selected.loan.status} /></div>
            <Link href={`/dashboard/money-list/${selected.loan.id}`} className="mt-4 inline-block text-sm text-ink underline underline-offset-4">Open the full loan</Link>
          </aside>
        )}
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return cx("inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border px-4 text-sm transition", active ? "border-ink bg-ink text-page" : "border-rule bg-surface text-ink-2 hover:border-ink");
}
