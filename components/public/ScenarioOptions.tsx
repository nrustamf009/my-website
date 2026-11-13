"use client";

import { useEffect, useRef, useState } from "react";
import { dscr, pct, points, rate, usd, usdMagnitude } from "@/lib/format";
import { t } from "@/lib/strings/en";
import type { Prepay, Product, ScenarioOptionResult } from "@/lib/dscr";
import { Button, Textarea, cx } from "@/components/ui";

export interface PublicOption {
  id: string;
  label: string;
  recommended: boolean;
  product: Product;
  loanAmountCents: number;
  rateMilli: number;
  pointsRatio: number;
  feesCents: number;
  prepay: Prepay;
  result: ScenarioOptionResult;
  vsFirst: { extraUpfrontCents: number; monthlySavingsCents: number; breakevenMonths: number | null } | null;
}

function useVisit(slug: string, token: string) {
  const key = useRef<string>("");
  useEffect(() => {
    key.current = crypto.randomUUID().replace(/-/g, "");
    const base = `/api/public/${slug}/s/${token}`;
    const post = (body: object) => fetch(`${base}/view`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitKey: key.current, ...body }), keepalive: true }).catch(() => {});
    post({ phase: "start" });
    let active = 0;
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState === "visible") active += Math.round((Date.now() - last) / 1000);
      last = Date.now();
    };
    const iv = setInterval(() => { tick(); post({ phase: "ping", activeSeconds: active }); }, 15_000);
    const onHide = () => { tick(); post({ phase: "ping", activeSeconds: active }); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide); };
  }, [slug, token]);
  return key;
}

export function ScenarioOptions({ slug, token, options, mode, loFirstName, initialPicked, hasPayoff }: { slug: string; token: string; options: PublicOption[]; mode: string; loFirstName: string; initialPicked: string | null; hasPayoff: boolean }) {
  const visit = useVisit(slug, token);
  const [open, setOpen] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState<string | null>(initialPicked);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purchase = mode === "PURCHASE";

  const expand = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) fetch(`/api/public/${slug}/s/${token}/expand`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: id, visitKey: visit.current }) }).catch(() => {});
  };
  const submit = async (id: string) => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${slug}/s/${token}/interest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: id, question: question.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setPicked(id);
      setAsking(null);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };
  const pickedLabel = options.find((o) => o.id === picked)?.label;

  return (
    <div>
      {pickedLabel && (
        <div className="mb-4 rounded-2xl bg-good-soft px-4 py-3 text-sm text-good" role="status" data-testid="picked-banner">{t.scenario.picked(pickedLabel, loFirstName)}</div>
      )}
      <div className="grid gap-4 lg:grid-cols-3" data-testid="options">
        {options.map((o) => {
          const r = o.result;
          const cashLabel = !purchase && hasPayoff && (r.cashToBorrowerCents ?? 0) > 0 ? "Cash to you" : "Cash to close";
          const cashValue = cashLabel === "Cash to you" ? usd(r.cashToBorrowerCents) : usd(r.cashToCloseCents);
          return (
            <article key={o.id} className={cx("relative flex flex-col rounded-3xl border bg-card p-5 shadow-sm", o.recommended ? "border-accent ring-1 ring-accent" : "border-line", picked === o.id && "ring-2 ring-good")} data-testid={`option-${o.label}`}>
              {o.recommended && <span className="absolute -top-3 left-5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">Recommended</span>}
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-2xl text-ink">Option {o.label}</h2>
                <span className="text-sm text-muted">{t.productShort[o.product]}</span>
              </div>
              <div className="mt-3">
                <div className="text-xs text-muted">{r.postIoPitiaCents ? "Monthly payment (interest-only years)" : "Monthly payment"}</div>
                <div className="num font-display text-4xl leading-tight text-ink">{usd(r.pitiaCents)}<span className="text-base text-muted">/mo</span></div>
                {r.postIoPitiaCents && <div className="text-xs text-warn">Rises to {usd(r.postIoPitiaCents)}/mo after year {r.ioMonths / 12}</div>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-xs text-muted">Rate</dt><dd className="num font-semibold">{rate(o.rateMilli)}</dd></div>
                <div><dt className="text-xs text-muted">DSCR</dt><dd className="num font-semibold">{dscr(r.dscrRatio)}</dd></div>
                <div><dt className="text-xs text-muted">{cashLabel}</dt><dd className="num font-semibold">{cashValue}</dd></div>
                <div><dt className="text-xs text-muted">5-year cost</dt><dd className="num font-semibold">{usd(r.fiveYearCostCents)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted">{t.prepay[o.prepay]}{o.pointsRatio > 0 ? ` · ${points(o.pointsRatio)} to buy the rate down` : o.pointsRatio < 0 ? ` · ${points(o.pointsRatio)}` : ""}</p>
              {o.vsFirst?.breakevenMonths && <p className="mt-1 text-xs text-ink-2">Costs {usd(o.vsFirst.extraUpfrontCents)} more upfront than A, saves {usd(o.vsFirst.monthlySavingsCents)}/mo: pays for itself in about {o.vsFirst.breakevenMonths} months.</p>}

              <button type="button" onClick={() => expand(o.id)} aria-expanded={open === o.id} className="mt-4 flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-sm font-medium text-ink-2">
                {open === o.id ? "Hide details" : "See details"}
                <svg viewBox="0 0 24 24" className={cx("h-4 w-4 transition", open === o.id && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {open === o.id && (
                <div className="mt-3 space-y-3 text-sm" data-testid={`details-${o.label}`}>
                  <dl className="space-y-1">
                    {([
                      ["Loan amount", `${usd(o.loanAmountCents)} (${pct(r.ltvRatio)} LTV)`],
                      [r.postIoPiCents ? "Interest-only payment" : "Principal & interest", usd(r.piCents, { cents: true })],
                      ["Taxes, insurance, HOA", usd(r.escrowCents, { cents: true })],
                      ["Cash flow", `${usd(r.cashFlowCents)}/mo`],
                      ...(purchase ? ([["Down payment", usd(r.downPaymentCents)]] as [string, string][]) : []),
                      ["Closing costs (est.)", usd(r.closingCostsCents)],
                      ["Prepaids & escrow (est.)", usd(r.prepaidsCents)],
                      ...(r.pointsCents ? ([[r.pointsCents > 0 ? "Points" : "Lender credit", usdMagnitude(r.pointsCents)]] as [string, string][]) : []),
                    ] as [string, string][]).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="num">{v}</dd></div>)}
                  </dl>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">If you sell or refinance early</div>
                    {r.prepaySchedule.length === 0 ? (
                      <p className="text-muted">No prepayment penalty.</p>
                    ) : (
                      <table className="w-full text-sm"><tbody className="divide-y divide-line">
                        {r.prepaySchedule.map((y) => <tr key={y.year}><td className="py-1 text-muted">Year {y.year}</td><td className="num py-1 text-right">{pct(y.penaltyRatio)}</td><td className="num py-1 text-right">{usd(y.penaltyCents)}</td></tr>)}
                      </tbody></table>
                    )}
                    <p className="mt-1 text-xs text-muted">{t.prepayExplainer[o.prepay]}</p>
                  </div>
                </div>
              )}

              <div className="mt-auto pt-4">
                {asking === o.id ? (
                  <div className="space-y-2">
                    <label htmlFor={`q-${o.id}`} className="block text-sm font-medium text-ink">{t.scenario.questionLabel}</label>
                    <Textarea id={`q-${o.id}`} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} />
                    {error && <p className="text-sm text-bad" role="alert">{error}</p>}
                    <div className="flex gap-2">
                      <Button variant="accent" className="flex-1" disabled={pending} onClick={() => submit(o.id)}>{pending ? "Sending…" : `Send to ${loFirstName}`}</Button>
                      <Button variant="ghost" onClick={() => setAsking(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant={picked === o.id ? "secondary" : "accent"} className="w-full" size="lg" disabled={picked === o.id} onClick={() => setAsking(o.id)}>
                    {picked === o.id ? "Your pick ✓" : picked ? t.scenario.switchTo(o.label) : t.scenario.interested(o.label)}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
