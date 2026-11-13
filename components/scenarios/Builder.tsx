"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeScenarioOption, defaultScenarioLoan, estimateEscrow, FICO_BUCKETS, PREPAYS, priceScenarioOption, PRODUCTS, PROPERTY_TYPES, ratioCeil, US_STATES, type EngineContext, type FicoBucket, type Mode, type Prepay, type Product, type ScenarioPropertyInput, type UsState } from "@/lib/dscr";
import { saveScenario } from "@/lib/actions/scenarios";
import type { ScenarioInput } from "@/lib/scenario-schema";
import { normalizeAddress } from "@/lib/providers/address";
import { dscr, parseRateToMilli, pct, points as fmtPoints, rate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { Button, Card, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { MoneyInput } from "@/components/public/MoneyInput";

export interface BuilderOption {
  product: Product;
  loanAmountCents: number;
  rateMilli: number;
  pointsRatio: number;
  feesCents: number;
  prepay: Prepay;
  recommended: boolean;
}

export interface BuilderInitial {
  id?: string;
  leadId?: string;
  investorName: string;
  investorEmail: string;
  investorPhone: string;
  mode: Mode;
  propertyAddress: string;
  state: UsState | "";
  propertyType: string;
  use: "LTR" | "STR";
  valueCents: number | null;
  currentBalanceCents: number | null;
  rentCents: number | null;
  taxesAnnualCents: number | null;
  insuranceAnnualCents: number | null;
  hoaMonthlyCents: number;
  ficoBucket: FicoBucket;
  note: string;
  options: BuilderOption[] | null;
  /** Purchase down payment ratio used to seed loan amounts. */
  downRatio?: number;
}

const LABELS = ["A", "B", "C"];
const POINT_STEPS = [-100, -50, 0, 25, 50, 75, 100, 150, 200];

export function ScenarioBuilder({ ctx, initial, feesDefaultCents }: { ctx: EngineContext; initial: BuilderInitial; feesDefaultCents: number }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [opts, setOpts] = useState<BuilderOption[] | null>(initial.options);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof BuilderInitial>(k: K, v: BuilderInitial[K]) => setF((x) => ({ ...x, [k]: v }));

  const est = f.state && f.valueCents ? estimateEscrow(f.state as UsState, f.valueCents, ctx) : null;
  const taxes = f.taxesAnnualCents ?? est?.taxesAnnualCents ?? null;
  const ins = f.insuranceAnnualCents ?? est?.insuranceAnnualCents ?? null;
  const property: ScenarioPropertyInput | null =
    f.valueCents && f.rentCents && taxes != null && ins != null
      ? { mode: f.mode, valueCents: f.valueCents, rentCents: f.rentCents, taxesAnnualCents: taxes, insuranceAnnualCents: ins, hoaMonthlyCents: f.hoaMonthlyCents, currentBalanceCents: f.mode === "PURCHASE" ? null : f.currentBalanceCents }
      : null;

  // Seed three options the first time the property is complete.
  const seed = () => {
    if (!property) return;
    const loan = defaultScenarioLoan(f.mode, property.valueCents, f.downRatio ?? null);
    const mk = (product: Product, prepay: Prepay, pointsRatio: number, recommended: boolean): BuilderOption => ({
      product,
      prepay,
      pointsRatio,
      feesCents: feesDefaultCents,
      loanAmountCents: loan,
      rateMilli: priceScenarioOption(property, { product, prepay, pointsRatio, feesCents: feesDefaultCents, loanAmountCents: loan }, ctx.grid, f.ficoBucket),
      recommended,
    });
    setOpts([mk("FIXED30", "5-4-3-2-1", 0, true), mk("IO30", "5-4-3-2-1", 0, false), mk("FIXED30", "5-4-3-2-1", 100, false)]);
  };

  const results = useMemo(() => (property && opts ? opts.map((o) => computeScenarioOption(property, o, ctx.grid)) : null), [property, opts, ctx.grid]);
  const setOpt = (i: number, patch: Partial<BuilderOption>) => setOpts((xs) => xs!.map((o, j) => (j === i ? { ...o, ...patch } : patch.recommended ? { ...o, recommended: false } : o)));
  const reprice = (i: number) => property && opts && setOpt(i, { rateMilli: priceScenarioOption(property, opts[i]!, ctx.grid, f.ficoBucket) });

  async function save() {
    setFormError(null);
    setErrors({});
    if (!property || !opts) return setFormError("Fill in the property first.");
    const input: ScenarioInput = {
      id: f.id,
      leadId: f.leadId,
      investorName: f.investorName,
      investorEmail: f.investorEmail,
      investorPhone: f.investorPhone,
      mode: f.mode,
      propertyAddress: f.propertyAddress,
      state: f.state as UsState,
      propertyType: f.propertyType,
      use: f.use,
      valueCents: property.valueCents,
      currentBalanceCents: property.currentBalanceCents ?? null,
      rentCents: property.rentCents,
      taxesAnnualCents: property.taxesAnnualCents,
      insuranceAnnualCents: property.insuranceAnnualCents,
      hoaMonthlyCents: property.hoaMonthlyCents,
      ficoBucket: f.ficoBucket,
      note: f.note,
      options: opts,
    };
    start(async () => {
      let r: Awaited<ReturnType<typeof saveScenario>>;
      try {
        r = await saveScenario(input);
      } catch {
        setFormError("Couldn't save. Check your connection and try again.");
        return;
      }
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.error ?? "Please fix the highlighted fields.");
        return;
      }
      router.push(`/dashboard/scenarios/${r.id}`);
      router.refresh();
    });
  }

  const purchase = f.mode === "PURCHASE";
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl">Investor</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name" htmlFor="sb-name" error={errors.investorName}><Input id="sb-name" value={f.investorName} onChange={(e) => set("investorName", e.target.value)} /></Field>
          <Field label="Email" htmlFor="sb-email" error={errors.investorEmail}><Input id="sb-email" type="email" value={f.investorEmail} onChange={(e) => set("investorEmail", e.target.value)} /></Field>
          <Field label="Phone" htmlFor="sb-phone"><Input id="sb-phone" type="tel" value={f.investorPhone} onChange={(e) => set("investorPhone", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl">Property</h2>
        <div className="mb-3 flex gap-1 rounded-xl bg-paper p-1 text-sm" role="tablist">
          {(["PURCHASE", "RATE_TERM", "CASH_OUT"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={f.mode === m} onClick={() => set("mode", m)} className={cx("flex-1 rounded-lg px-3 py-2 font-medium transition", f.mode === m ? "bg-surface text-ink shadow-sm" : "text-muted")}>{t.mode[m]}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Property address" htmlFor="sb-address" error={errors.propertyAddress}>
            <Input id="sb-address" value={f.propertyAddress} onChange={(e) => { set("propertyAddress", e.target.value); const s = normalizeAddress(e.target.value).state; if (s) set("state", s); }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" htmlFor="sb-state" error={errors.state}>
              <Select id="sb-state" value={f.state} onChange={(e) => set("state", e.target.value as UsState)}><option value="">…</option>{US_STATES.map((s) => <option key={s}>{s}</option>)}</Select>
            </Field>
            <Field label="Type" htmlFor="sb-type"><Select id="sb-type" value={f.propertyType} onChange={(e) => set("propertyType", e.target.value)}>{PROPERTY_TYPES.map((p) => <option key={p} value={p}>{t.propertyType[p]}</option>)}</Select></Field>
          </div>
          <Field label={purchase ? "Purchase price" : "Estimated value"} htmlFor="sb-value" error={errors.valueCents}><MoneyInput id="sb-value" value={f.valueCents} onChange={(v) => set("valueCents", v)} /></Field>
          {!purchase && <Field label="Current loan payoff" htmlFor="sb-balance" hint="Shows cash to the investor"><MoneyInput id="sb-balance" value={f.currentBalanceCents} onChange={(v) => set("currentBalanceCents", v)} /></Field>}
          <Field label="Monthly rent" htmlFor="sb-rent" error={errors.rentCents}><MoneyInput id="sb-rent" value={f.rentCents} onChange={(v) => set("rentCents", v)} suffix="/mo" /></Field>
          <Field label="Credit score" htmlFor="sb-fico"><Select id="sb-fico" value={f.ficoBucket} onChange={(e) => set("ficoBucket", e.target.value as FicoBucket)}>{FICO_BUCKETS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Taxes per year" htmlFor="sb-taxes" hint={f.taxesAnnualCents == null && est ? `State estimate ${usd(est.taxesAnnualCents)}` : undefined}><MoneyInput id="sb-taxes" value={f.taxesAnnualCents} placeholder={est ? usd(est.taxesAnnualCents).replace("$", "") : ""} onChange={(v) => set("taxesAnnualCents", v)} /></Field>
          <Field label="Insurance per year" htmlFor="sb-ins" hint={f.insuranceAnnualCents == null && est ? `State estimate ${usd(est.insuranceAnnualCents)}` : undefined}><MoneyInput id="sb-ins" value={f.insuranceAnnualCents} placeholder={est ? usd(est.insuranceAnnualCents).replace("$", "") : ""} onChange={(v) => set("insuranceAnnualCents", v)} /></Field>
          <Field label="HOA per month" htmlFor="sb-hoa"><MoneyInput id="sb-hoa" value={f.hoaMonthlyCents} onChange={(v) => set("hoaMonthlyCents", v ?? 0)} /></Field>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Options</h2>
            <p className="text-sm text-muted">Rates default to your program grid; type the lender&apos;s actual pricing to override.</p>
          </div>
          {opts && opts.length < 3 && <Button variant="secondary" size="sm" onClick={() => setOpts([...opts, { ...opts[opts.length - 1]!, recommended: false }])}>Add option</Button>}
        </div>
        {!opts ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted">{property ? "Start from three common structures and adjust." : "Enter price or value, rent and state to build options."}</p>
            <Button className="mt-3" variant="accent" disabled={!property} onClick={seed}>Build options</Button>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3" data-testid="builder-options">
            {opts.map((o, i) => {
              const r = results?.[i];
              return (
                <Card key={i} className={cx("p-4", o.recommended && "ring-2 ring-accent")}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-display text-xl">Option {LABELS[i]}</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted"><input type="radio" name="recommended" checked={o.recommended} onChange={() => setOpt(i, { recommended: true })} /> Recommend</label>
                      {opts.length > 2 && <button type="button" className="text-xs text-bad" onClick={() => setOpts(opts.filter((_, j) => j !== i))} aria-label={`Remove option ${LABELS[i]}`}>Remove</button>}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Field label="Product" htmlFor={`o${i}-product`}><Select id={`o${i}-product`} value={o.product} onChange={(e) => setOpt(i, { product: e.target.value as Product })}>{PRODUCTS.map((p) => <option key={p} value={p}>{t.product[p]}</option>)}</Select></Field>
                    <Field label={`Loan amount${property ? ` · ${pct(ratioCeil(o.loanAmountCents, property.valueCents) ?? 0)} LTV` : ""}`} htmlFor={`o${i}-loan`}><MoneyInput id={`o${i}-loan`} value={o.loanAmountCents} onChange={(v) => setOpt(i, { loanAmountCents: v ?? 0 })} /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Rate" htmlFor={`o${i}-rate`}>
                        <RateInput id={`o${i}-rate`} milli={o.rateMilli} onChange={(m) => setOpt(i, { rateMilli: m })} />
                      </Field>
                      <Field label="Points" htmlFor={`o${i}-points`}>
                        <Select id={`o${i}-points`} value={o.pointsRatio} onChange={(e) => setOpt(i, { pointsRatio: Number(e.target.value) })}>
                          {POINT_STEPS.map((p) => <option key={p} value={p}>{p < 0 ? `${fmtPoints(-p)} credit` : p === 0 ? "None" : fmtPoints(p)}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <button type="button" className="text-xs text-accent underline" onClick={() => reprice(i)}>Price from grid</button>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Lender fees" htmlFor={`o${i}-fees`}><MoneyInput id={`o${i}-fees`} value={o.feesCents} onChange={(v) => setOpt(i, { feesCents: v ?? 0 })} /></Field>
                      <Field label="Prepay" htmlFor={`o${i}-prepay`}><Select id={`o${i}-prepay`} value={o.prepay} onChange={(e) => setOpt(i, { prepay: e.target.value as Prepay })}>{PREPAYS.map((p) => <option key={p} value={p}>{p === "NONE" ? "None" : p}</option>)}</Select></Field>
                    </div>
                  </div>
                  {r && (
                    <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm" data-testid={`builder-result-${LABELS[i]}`}>
                      <Row k={r.postIoPitiaCents ? "Payment (IO period)" : "Payment (PITIA)"} v={`${usd(r.pitiaCents)}/mo`} strong />
                      {r.postIoPitiaCents && <Row k="After IO" v={`${usd(r.postIoPitiaCents)}/mo`} />}
                      <Row k="DSCR" v={dscr(r.dscrRatio)} strong />
                      <Row k={r.cashToBorrowerCents != null && r.cashToBorrowerCents > 0 ? "Cash to investor" : "Cash to close"} v={usd(r.cashToBorrowerCents != null && r.cashToBorrowerCents > 0 ? r.cashToBorrowerCents : r.cashToCloseCents)} />
                      <Row k="5-year cost" v={usd(r.fiveYearCostCents)} />
                      <Row k="Rate" v={rate(o.rateMilli)} />
                    </dl>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card className="p-5">
        <Field label="Note to the investor (optional)" htmlFor="sb-note" error={errors.note}><Textarea id="sb-note" rows={3} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Option A keeps the payment lowest; Option C buys the rate down if you plan to hold 7+ years." /></Field>
      </Card>

      {formError && <Notice tone="bad">{formError}</Notice>}
      <div className="flex gap-2">
        <Button variant="accent" size="lg" onClick={save} disabled={pending || !opts}>{pending ? "Saving…" : f.id ? "Save changes" : "Save scenario"}</Button>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className={cx("num", strong && "font-semibold text-ink")}>{v}</dd></div>;
}

function RateInput({ id, milli, onChange }: { id: string; milli: number; onChange: (m: number) => void }) {
  const [text, setText] = useState(rate(milli).replace("%", ""));
  const [last, setLast] = useState(milli);
  if (milli !== last) {
    setLast(milli);
    setText(rate(milli).replace("%", ""));
  }
  return (
    <div className="relative">
      <Input id={id} inputMode="decimal" value={text} onChange={(e) => { setText(e.target.value); const m = parseRateToMilli(e.target.value); if (m != null && m >= 1_000 && m <= 20_000) { setLast(m); onChange(m); } }} className="num pr-7" />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
    </div>
  );
}
