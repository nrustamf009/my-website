"use client";

import { useEffect, useRef, useState } from "react";
import { dscr, pct, points, rate, usd, usdMagnitude } from "@/lib/format";
import { t } from "@/lib/strings/en";
import type { Prepay, Product, ScenarioOptionResult } from "@/lib/dscr";
import { Textarea, cx } from "@/components/ui";
import { OptionCompare, type CompareOption } from "@design/variants/OptionCompare";

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

export function ScenarioOptions({ slug, token, options, mode, loFirstName, initialPicked, hasPayoff, minDscr, strongDscr }: { slug: string; token: string; options: PublicOption[]; mode: string; loFirstName: string; initialPicked: string | null; hasPayoff: boolean; minDscr: number; strongDscr: number }) {
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
  const maxCf = Math.max(...options.map((o) => o.result.cashFlowCents));
  const minRate = Math.min(...options.map((o) => o.rateMilli));
  const compare: CompareOption[] = options.map((o) => {
    const r = o.result;
    const tag = options.length > 1 && o.result.cashFlowCents === maxCf && options.filter((x) => x.result.cashFlowCents === maxCf).length === 1 ? "Highest cash flow" : o.rateMilli === minRate && options.filter((x) => x.rateMilli === minRate).length === 1 ? "Lowest rate" : o.pointsRatio === 0 ? "No points" : null;
    const later = r.postIoPitiaCents ? `The payment rises to about ${usd(r.postIoPitiaCents)} in year ${r.ioMonths / 12 + 1}, when principal begins. ` : "";
    return {
      id: o.id,
      label: o.label,
      tag,
      recommended: o.recommended,
      rateMilli: o.rateMilli,
      productLong: t.product[o.product],
      productShort: t.productShort[o.product],
      pitiaCents: r.pitiaCents,
      dscrRatio: r.dscrRatio,
      cashFlowCents: r.cashFlowCents,
      pointsLabel: o.pointsRatio === 0 ? "0" : points(o.pointsRatio),
      pointsCostCents: Math.max(0, r.pointsCents),
      prepayShort: o.prepay === "NONE" ? "None" : o.prepay,
      postIoPitiaCents: r.postIoPitiaCents,
      note: `${later}${t.prepayExplainer[o.prepay]}${o.vsFirst?.breakevenMonths ? ` Costs ${usd(o.vsFirst.extraUpfrontCents)} more upfront than A and saves ${usd(o.vsFirst.monthlySavingsCents)} a month: pays for itself in about ${o.vsFirst.breakevenMonths} months.` : ""}`,
    };
  });
  const byId = new Map(options.map((o) => [o.id, o]));

  const details = (c: CompareOption) => {
    const o = byId.get(c.id)!;
    const r = o.result;
    const cashToYou = !purchase && hasPayoff && (r.cashToBorrowerCents ?? 0) > 0;
    return (
      <div className="space-y-3 text-sm">
        <dl className="space-y-1">
          {([
            ["Loan amount", `${usd(o.loanAmountCents)} (${pct(r.ltvRatio)} LTV)`],
            [r.postIoPiCents ? "Interest-only payment" : "Principal & interest", usd(r.piCents, { cents: true })],
            ["Taxes, insurance, HOA", usd(r.escrowCents, { cents: true })],
            ...(purchase ? ([["Down payment", usd(r.downPaymentCents)]] as [string, string][]) : []),
            ["Closing costs (est.)", usd(r.closingCostsCents)],
            ["Prepaids & escrow (est.)", usd(r.prepaidsCents)],
            ...(r.pointsCents ? ([[r.pointsCents > 0 ? "Points" : "Lender credit", usdMagnitude(r.pointsCents)]] as [string, string][]) : []),
            [cashToYou ? "Cash to you" : "Cash to close", cashToYou ? usd(r.cashToBorrowerCents) : usd(r.cashToCloseCents)],
            ["5-year cost", usd(r.fiveYearCostCents)],
          ] as [string, string][]).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="opacity-80">{k}</dt><dd className="num">{v}</dd></div>)}
        </dl>
        <div>
          <div className="type-eyebrow mb-1 opacity-80">If you sell or refinance early</div>
          {r.prepaySchedule.length === 0 ? (
            <p className="opacity-80">No prepayment penalty.</p>
          ) : (
            <table className="w-full text-sm"><tbody>
              {r.prepaySchedule.map((y) => <tr key={y.year} className="border-t border-current/20"><td className="py-1 opacity-80">Year {y.year}</td><td className="num py-1 text-right">{pct(y.penaltyRatio)}</td><td className="num py-1 text-right">{usd(y.penaltyCents)}</td></tr>)}
            </tbody></table>
          )}
        </div>
      </div>
    );
  };

  const action = (c: CompareOption, emphasis: "primary" | "secondary" | "on-block") => {
    const btn = emphasis === "primary" ? "cta bg-accent text-on-accent" : emphasis === "on-block" ? "min-h-14 bg-surface text-ink" : "min-h-14 border border-current";
    if (asking === c.id) {
      return (
        <div className="space-y-2">
          <label htmlFor={`q-${c.id}`} className="block text-sm font-medium">{t.scenario.questionLabel}</label>
          <Textarea id={`q-${c.id}`} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} />
          {error && <p className="text-sm" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className={cx("flex-1 px-4 font-semibold", btn)} disabled={pending} onClick={() => submit(c.id)}>{pending ? "Sending…" : `Send to ${loFirstName}`}</button>
            <button type="button" className="px-4 text-sm underline" onClick={() => setAsking(null)}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <button type="button" disabled={picked === c.id} onClick={() => setAsking(c.id)} className={cx("flex w-full items-center justify-between gap-2 px-5 text-left font-semibold disabled:opacity-70", btn)}>
        <span>{picked === c.id ? `Your pick: Option ${c.label}` : picked ? t.scenario.switchTo(c.label) : t.scenario.interested(c.label)}</span>
        <svg viewBox="0 0 24 24" className="icon h-5 w-5 shrink-0" fill="none" stroke="currentColor" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    );
  };

  return (
    <div>
      {pickedLabel && (
        <div className="mb-4 border border-rule bg-positive-tint px-4 py-3 text-sm text-positive" role="status" data-testid="picked-banner">{t.scenario.picked(pickedLabel, loFirstName)}</div>
      )}
      <div data-testid="options">
        <OptionCompare options={compare} picked={picked} min={minDscr} strong={strongDscr} details={details} action={action} open={open} onToggle={expand} />
      </div>
    </div>
  );
}
