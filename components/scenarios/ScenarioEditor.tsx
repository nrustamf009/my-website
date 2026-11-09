"use client";

import { useMemo, useState, useTransition } from "react";
import { computeScenarioOption, escrowFromPrice, loanFromLtv, PREPAY_LABEL, type PrepayType } from "@/lib/dscr";
import { pct, ratio, usd } from "@/lib/format";
import { saveScenario, type SaveState } from "@/lib/actions/scenarios";
import { defaultOption, type ScenarioInput } from "@/lib/scenario-schema";
import { Badge, Button, Card, CardHeader, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { MoneyInput } from "@/components/public/MoneyInput";

type Opt = ScenarioInput["options"][number];

export function ScenarioEditor({
  id,
  initial,
  taxRatePct,
  insuranceRatePct,
  defaultRate,
  callId,
}: {
  id: string | null;
  initial: ScenarioInput;
  taxRatePct: number;
  insuranceRatePct: number;
  defaultRate: number;
  callId?: string | null;
}) {
  const [s, setS] = useState<ScenarioInput>(initial);
  const [escrowAuto, setEscrowAuto] = useState(!id && !initial.taxesMonthly);
  const [state, setState] = useState<SaveState>({});
  const [pending, start] = useTransition();
  const e = state.fieldErrors ?? {};

  const set = <K extends keyof ScenarioInput>(k: K, v: ScenarioInput[K]) => setS((p) => ({ ...p, [k]: v }));
  const setOpt = (i: number, patch: Partial<Opt>) => setS((p) => ({ ...p, options: p.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));

  function setValue(v: number | null) {
    setS((p) => {
      const value = v ?? 0;
      const next = { ...p, propertyValue: value };
      if (escrowAuto && value) {
        const esc = escrowFromPrice(value, taxRatePct, insuranceRatePct);
        next.taxesMonthly = Math.round(esc.taxesMonthly);
        next.insuranceMonthly = Math.round(esc.insuranceMonthly);
      }
      if (!p.options.some((o) => o.loanAmount) && value) next.options = p.options.map((o) => ({ ...o, loanAmount: loanFromLtv(value, 0.75) }));
      return next;
    });
  }

  const results = useMemo(
    () =>
      s.options.map((o) => {
        try {
          return computeScenarioOption({
            propertyValue: s.propertyValue || 0,
            monthlyRent: s.monthlyRent || 0,
            escrow: { taxesMonthly: s.taxesMonthly || 0, insuranceMonthly: s.insuranceMonthly || 0, hoaMonthly: s.hoaMonthly || 0 },
            isPurchase: s.loanPurpose === "PURCHASE",
            option: { ...o, prepay: o.prepay as PrepayType },
          });
        } catch {
          return null;
        }
      }),
    [s],
  );

  const submit = (share: boolean) =>
    start(async () => {
      const r = await saveScenario(id, s, share, callId ?? null);
      if (r) setState(r);
    });

  return (
    <div className="space-y-6">
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      {Object.keys(e).length > 0 && <Notice tone="bad">Please fix the highlighted fields.</Notice>}
      <Card>
        <CardHeader title="Investor & property" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Investor name" error={e.investorName}><Input value={s.investorName} onChange={(ev) => set("investorName", ev.target.value)} /></Field>
          <Field label="Investor email" error={e.investorEmail}><Input type="email" value={s.investorEmail} onChange={(ev) => set("investorEmail", ev.target.value)} /></Field>
          <Field label="Investor phone"><Input value={s.investorPhone} onChange={(ev) => set("investorPhone", ev.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Property address" error={e.propertyAddress}><Input value={s.propertyAddress} onChange={(ev) => set("propertyAddress", ev.target.value)} /></Field></div>
          <Field label="Loan purpose">
            <Select value={s.loanPurpose} onChange={(ev) => set("loanPurpose", ev.target.value as ScenarioInput["loanPurpose"])}>
              <option value="PURCHASE">Purchase</option>
              <option value="RATE_TERM">Rate & term refinance</option>
              <option value="CASH_OUT">Cash-out refinance</option>
            </Select>
          </Field>
          <Field label={s.loanPurpose === "PURCHASE" ? "Purchase price" : "Estimated value"} error={e.propertyValue}><MoneyInput value={s.propertyValue || null} onChange={setValue} /></Field>
          <Field label="Monthly rent" error={e.monthlyRent}><MoneyInput value={s.monthlyRent || null} onChange={(v) => set("monthlyRent", v ?? 0)} suffix="/mo" /></Field>
          <Field label="HOA / month"><MoneyInput value={s.hoaMonthly || null} onChange={(v) => set("hoaMonthly", v ?? 0)} /></Field>
          <Field label="Taxes / month" hint={escrowAuto ? `Auto: ${taxRatePct}% of value per year` : undefined}><MoneyInput value={s.taxesMonthly || null} onChange={(v) => { setEscrowAuto(false); set("taxesMonthly", v ?? 0); }} /></Field>
          <Field label="Insurance / month" hint={escrowAuto ? `Auto: ${insuranceRatePct}% of value per year` : undefined}><MoneyInput value={s.insuranceMonthly || null} onChange={(v) => { setEscrowAuto(false); set("insuranceMonthly", v ?? 0); }} /></Field>
          <div className="sm:col-span-3"><Field label="Personal note shown on the scenario page (optional)"><Textarea rows={2} value={s.note} onChange={(ev) => set("note", ev.target.value)} placeholder="Here are the options we discussed. Option B is my pick if you plan to hold 3+ years." /></Field></div>
        </div>
      </Card>

      <div className={cx("grid gap-4", s.options.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {s.options.map((o, i) => {
          const r = results[i];
          return (
            <Card key={o.label} className={cx("flex flex-col", o.recommended && "ring-2 ring-[color:var(--accent)]")}>
              <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
                <div className="font-display text-xl">Option {o.label}</div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-pressed={o.recommended}
                    onClick={() => setS((p) => ({ ...p, options: p.options.map((x, j) => ({ ...x, recommended: j === i ? !x.recommended : false })) }))}
                    className={cx("rounded-full px-2.5 py-1 text-xs font-semibold transition", o.recommended ? "bg-accent text-on-accent" : "bg-black/5 text-ink-2 hover:bg-black/10")}
                  >
                    {o.recommended ? "★ My pick" : "☆ Recommend"}
                  </button>
                  {s.options.length > 2 && <button type="button" onClick={() => setS((p) => ({ ...p, options: p.options.filter((_, j) => j !== i).map((x, j) => ({ ...x, label: (["A", "B", "C"] as const)[j]! })) }))} className="text-xs text-muted hover:text-bad">Remove</button>}
                </div>
              </div>
              <div className="space-y-3 p-5">
                <Field label={`Loan amount${r && s.propertyValue ? ` · ${pct(r.ltv)} LTV` : ""}`} error={e[`options.${i}.loanAmount`]}>
                  <MoneyInput value={o.loanAmount || null} onChange={(v) => setOpt(i, { loanAmount: v ?? 0 })} />
                </Field>
                {s.propertyValue > 0 && (
                  <div className="flex gap-1.5">
                    {[0.65, 0.7, 0.75, 0.8].map((l) => <button key={l} type="button" onClick={() => setOpt(i, { loanAmount: loanFromLtv(s.propertyValue, l) })} className="h-7 flex-1 rounded-md border border-line text-xs hover:bg-paper">{pct(l)}</button>)}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rate %" error={e[`options.${i}.ratePct`]}><Input type="number" step="0.125" value={o.ratePct} onChange={(ev) => setOpt(i, { ratePct: Number(ev.target.value) })} /></Field>
                  <Field label="Term"><Select value={o.termYears} onChange={(ev) => setOpt(i, { termYears: Number(ev.target.value) })}><option value={30}>30 years</option><option value={40}>40 years</option></Select></Field>
                  <Field label="Points %"><Input type="number" step="0.125" min={0} value={o.pointsPct} onChange={(ev) => setOpt(i, { pointsPct: Number(ev.target.value) })} /></Field>
                  <Field label="Lender fees"><MoneyInput value={o.lenderFees || null} onChange={(v) => setOpt(i, { lenderFees: v ?? 0 })} /></Field>
                </div>
                <Field label="Prepayment penalty">
                  <Select value={o.prepay} onChange={(ev) => setOpt(i, { prepay: ev.target.value as Opt["prepay"] })}>
                    {(["5-4-3-2-1", "3-2-1", "NONE"] as const).map((p) => <option key={p} value={p}>{PREPAY_LABEL[p]}</option>)}
                  </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.interestOnly} onChange={(ev) => setOpt(i, { interestOnly: ev.target.checked, ioYears: ev.target.checked ? 10 : null })} className="h-4 w-4 accent-[var(--accent)]" />
                  Interest-only
                  {o.interestOnly && (
                    <select
                      aria-label="Interest-only period"
                      value={o.ioYears ?? 10}
                      onChange={(ev) => setOpt(i, { ioYears: Number(ev.target.value) })}
                      className="ml-auto h-8 rounded-md border border-line bg-white px-2 text-sm"
                    >
                      {[3, 5, 7, 10].map((y) => <option key={y} value={y}>for {y} years</option>)}
                    </select>
                  )}
                </label>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line bg-paper/60 px-5 py-3 text-center">
                <div><div className="text-[11px] text-muted">PITIA</div><div className="num font-semibold">{usd(r?.pitia)}</div></div>
                <div><div className="text-[11px] text-muted">DSCR</div><div className="num font-semibold">{ratio(r?.dscr)}</div></div>
                <div><div className="text-[11px] text-muted">{s.loanPurpose === "PURCHASE" ? "Cash to close" : "Upfront costs"}</div><div className="num font-semibold">{usd(r?.cashToClose)}</div></div>
              </div>
            </Card>
          );
        })}
        {s.options.length < 3 && (
          <button type="button" onClick={() => setS((p) => ({ ...p, options: [...p.options, defaultOption((["A", "B", "C"] as const)[p.options.length]!, p.propertyValue, defaultRate, p.options.length)] }))} className="grid min-h-48 place-items-center rounded-2xl border-2 border-dashed border-line text-sm font-medium text-muted hover:border-accent hover:text-accent">
            + Add option {(["A", "B", "C"] as const)[s.options.length]}
          </button>
        )}
      </div>
      {e.options && <p className="text-sm text-bad">{e.options}</p>}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Badge className="mr-auto hidden sm:inline-flex">{s.options.length} options · numbers update live</Badge>
        <Button variant="secondary" disabled={pending} onClick={() => submit(false)}>Save draft</Button>
        <Button variant="accent" disabled={pending} onClick={() => submit(true)}>{pending ? "Saving…" : "Save & get share link"}</Button>
      </div>
    </div>
  );
}
