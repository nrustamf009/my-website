"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { analyzeDeal, estimateEscrow, FICO_BUCKETS, PREPAYS, PRODUCTS, PROPERTY_TYPES, US_STATES, STATE_NAMES, type DealAnalysis, type EngineContext, type UsState } from "@/lib/dscr";
import { isAnalyzable, isSubmittable, toDealInput, type CheckForm } from "@/lib/check/form";
import { normalizeAddress } from "@/lib/providers/address";
import { dscr, pct, points, rate, usd, usdMagnitude, usdSigned } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { Badge, Card, cx, Input, Label, Select } from "@/components/ui";
import { DataRow, Eyebrow, Metric, Panel, SectionTitle } from "@design/components/primitives";
import { ResultHero } from "@design/variants/ResultHero";
import { VerdictBadge } from "@design/variants/VerdictBadge";
import { ImprovementList, type Improvement } from "@design/variants/ImprovementList";
import { LeadForm } from "./LeadForm";
import { MoneyInput } from "./MoneyInput";

const DOWN_CHIPS = [2_000, 2_500, 3_000, 3_500];
const OWNED = [
  [3, "Under 6 months"],
  [9, "6–11 months"],
  [24, "12 months or more"],
] as const;

export interface InstantCheckProps {
  slug: string;
  loSlug?: string | null;
  ctx: EngineContext;
  companyName: string;
  loFirstName: string;
  loPhone: string | null;
  privacyPolicyUrl: string | null;
  turnstileSiteKey: string | null;
  initial: Partial<CheckForm>;
  embed?: boolean;
  /** Listing page: the property is fixed; only assumptions can change. */
  listing?: { token: string; address: string };
}

export function InstantCheck(p: InstantCheckProps) {
  const [f, setF] = useState<Partial<CheckForm>>({ mode: "PURCHASE", propertyType: "SFR", units: 1, use: "LTR", fico: "740+", downPaymentRatio: 2_500, product: "FIXED30", prepay: "5-4-3-2-1", ...p.initial });
  const [rentSource, setRentSource] = useState<"provider" | "manual" | null>(p.initial.rentCents ? "manual" : null);
  const [rentRange, setRentRange] = useState<[number, number] | null>(null);
  const [taxSource, setTaxSource] = useState<"record" | "manual" | null>(p.initial.taxesAnnualCents ? "manual" : null);
  const [loading, setLoading] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof CheckForm>(k: K, v: CheckForm[K] | undefined) => setF((x) => ({ ...x, [k]: v }));
  const purchase = f.mode !== "CASH_OUT";

  // State from the address when possible.
  useEffect(() => {
    if (!f.address) return;
    const st = normalizeAddress(f.address).state;
    if (st && st !== f.state) set("state", st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.address]);

  // Rent range + tax record from the property provider (cached server-side for 30 days).
  useEffect(() => {
    if (p.listing || rentSource === "manual" || !f.address || f.address.trim().length < 10 || !/\d/.test(f.address)) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ address: f.address!, ...(f.priceCents || f.valueCents ? { priceCents: String(f.priceCents ?? f.valueCents) } : {}) });
        const res = await fetch(`/api/public/${p.slug}/property?${qs}`, { signal: ctrl.signal });
        const data = await res.json();
        if (data.property?.rentCents) {
          setF((x) => ({ ...x, rentCents: data.property.rentCents }));
          setRentSource("provider");
          setRentRange(data.property.rentLowCents && data.property.rentHighCents ? [data.property.rentLowCents, data.property.rentHighCents] : null);
        }
        if (data.property?.taxesAnnualCents && taxSource !== "manual") {
          setF((x) => ({ ...x, taxesAnnualCents: data.property.taxesAnnualCents }));
          setTaxSource("record");
        }
      } catch {
        /* the investor can type rent */
      } finally {
        setLoading(false);
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.address, f.priceCents, f.valueCents, rentSource]);

  // Embedded: report height so the host iframe auto-resizes.
  useEffect(() => {
    if (!p.embed) return;
    const ro = new ResizeObserver(() => window.parent?.postMessage({ type: "dscr-embed-height", height: document.documentElement.scrollHeight }, "*"));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [p.embed]);

  const deferred = useDeferredValue(f);
  const a: DealAnalysis | null = useMemo(() => {
    if (!isAnalyzable(deferred)) return null;
    try {
      return analyzeDeal(toDealInput(deferred), p.ctx);
    } catch {
      return null;
    }
  }, [deferred, p.ctx]);

  // One anonymous "check calculated" event per page view (powers ROI stats).
  const sent = useRef(false);
  useEffect(() => {
    if (!a || sent.current || p.listing) return;
    const timer = setTimeout(() => {
      sent.current = true;
      const utm = new URLSearchParams(window.location.search).get("utm_source") ?? undefined;
      navigator.sendBeacon?.(`/api/public/${p.slug}/event`, new Blob([JSON.stringify({ type: "check.calculated", verdict: a.verdict, utmSource: utm })], { type: "application/json" }));
    }, 2500);
    return () => clearTimeout(timer);
  }, [a, p.slug, p.listing]);

  const getForm = () => (isSubmittable(f) ? f : null);
  const estValue = purchase ? f.priceCents : f.valueCents;
  const est = f.state && estValue && (US_STATES as string[]).includes(f.state) ? estimateEscrow(f.state as UsState, estValue, p.ctx) : null;

  return (
    <div className={cx("grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8", !p.embed && !p.listing && "pb-24 lg:pb-0")}>
      {/* Inputs: a real GET form so the page works without JavaScript */}
      <Card className="h-fit scroll-mt-24 p-5 sm:p-6" ref={inputsRef}>
        <form method="get" onSubmit={(e) => e.preventDefault()} className="space-y-5" aria-label="Deal details">
          {p.loSlug && <input type="hidden" name="lo" value={p.loSlug} />}
          {!p.listing && (
            <div role="radiogroup" aria-label="Loan purpose" className="grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
              {(["PURCHASE", "CASH_OUT"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={f.mode === m} onClick={() => set("mode", m)} className={cx("h-10 rounded-lg text-sm font-semibold transition", f.mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
                  {m === "PURCHASE" ? "Buying" : "Cash-out refi"}
                </button>
              ))}
              <input type="hidden" name="mode" value={f.mode} />
            </div>
          )}
          {!p.listing && (
            <div>
              <Label htmlFor="ic-address">Property address</Label>
              <Input id="ic-address" name="address" value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, Austin, TX 78704" autoComplete="street-address" className="h-12 rounded-xl text-lg" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ic-state">State</Label>
              <Select id="ic-state" name="state" value={f.state ?? ""} onChange={(e) => set("state", e.target.value)} disabled={!!p.listing}>
                <option value="">Choose…</option>
                {US_STATES.map((s) => <option key={s} value={s}>{STATE_NAMES[s]}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="ic-type">Property type</Label>
              <Select id="ic-type" name="propertyType" value={f.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
                {PROPERTY_TYPES.map((x) => <option key={x} value={x}>{t.propertyType[x]}</option>)}
              </Select>
            </div>
          </div>

          {purchase ? (
            <>
              {!p.listing && (
                <div>
                  <Label htmlFor="ic-price">Purchase price</Label>
                  <MoneyInput id="ic-price" name="price" value={f.priceCents ?? null} onChange={(v) => set("priceCents", v ?? undefined)} placeholder="350,000" />
                </div>
              )}
              <div>
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="ic-down">Down payment</Label>
                  <span className="num text-sm font-semibold text-ink">{pct(f.downPaymentRatio)}{a ? <span className="font-normal text-muted"> · {usd(a.downPaymentCents)}</span> : null}</span>
                </div>
                <input id="ic-down" name="downPct" type="range" min={1_000} max={5_000} step={50} value={f.downPaymentRatio ?? 2_500} onChange={(e) => set("downPaymentRatio", Number(e.target.value))} className="range-accent w-full" aria-valuetext={pct(f.downPaymentRatio)} />
                <div className="mt-2 flex gap-2">
                  {DOWN_CHIPS.map((d) => (
                    <button key={d} type="button" onClick={() => set("downPaymentRatio", d)} className={cx("h-9 flex-1 rounded-lg border text-sm transition", f.downPaymentRatio === d ? "border-accent bg-accent-soft font-semibold text-accent-deep" : "border-line bg-surface text-ink-2 hover:bg-paper")}>{pct(d)}</button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="ic-value">Estimated value</Label><MoneyInput id="ic-value" name="value" value={f.valueCents ?? null} onChange={(v) => set("valueCents", v ?? undefined)} placeholder="450,000" /></div>
              <div><Label htmlFor="ic-bal">Current loan balance</Label><MoneyInput id="ic-bal" name="currentBalance" value={f.currentBalanceCents ?? null} onChange={(v) => set("currentBalanceCents", v ?? 0)} placeholder="0 if owned free and clear" /></div>
              <div><Label htmlFor="ic-cash">Cash out you want</Label><MoneyInput id="ic-cash" name="cashOut" value={f.cashOutCents ?? null} onChange={(v) => set("cashOutCents", v ?? 0)} placeholder="75,000" /></div>
              <div>
                <Label htmlFor="ic-owned">Owned for</Label>
                <Select id="ic-owned" name="monthsOwned" value={f.monthsOwned ?? 24} onChange={(e) => set("monthsOwned", Number(e.target.value))}>
                  {OWNED.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
              {f.monthsOwned === 9 && <div className="sm:col-span-2"><Label htmlFor="ic-pp">What you paid for it</Label><MoneyInput id="ic-pp" name="purchasePrice" value={f.purchasePriceCents ?? null} onChange={(v) => set("purchasePriceCents", v ?? undefined)} /></div>}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ic-fico">Approximate credit score</Label>
              <Select id="ic-fico" name="fico" value={f.fico} onChange={(e) => set("fico", e.target.value)}>
                {FICO_BUCKETS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ic-rent">Monthly rent{f.propertyType === "2-4" ? " (all units)" : ""}</Label>
                {loading ? <span className="text-xs text-muted">Looking up…</span> : rentSource === "provider" ? <Badge tone="accent">Estimate</Badge> : null}
              </div>
              <MoneyInput id="ic-rent" name="rent" value={f.rentCents ?? null} onChange={(v) => { set("rentCents", v ?? undefined); setRentSource("manual"); }} placeholder="2,600" suffix="/mo" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted">
            {rentRange && rentSource === "provider" ? `Typical range ${usd(rentRange[0])}–${usd(rentRange[1])}. ` : ""}{t.check.rentNote}
          </p>

          <button type="button" onClick={() => setAdvanced((x) => !x)} aria-expanded={advanced} className="flex w-full items-center justify-between rounded-lg py-1 text-sm font-medium text-ink-2">
            {t.check.adjust}
            <svg viewBox="0 0 24 24" className={cx("h-4 w-4 transition", advanced && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div className={cx("grid gap-4 sm:grid-cols-2", !advanced && "hidden")}>
            <div>
              <Label htmlFor="ic-tax">Property taxes per year</Label>
              <MoneyInput id="ic-tax" name="taxesAnnual" value={f.taxesAnnualCents ?? null} onChange={(v) => { set("taxesAnnualCents", v); setTaxSource("manual"); }} placeholder={est ? usd(est.taxesAnnualCents).replace("$", "") : "est. from state"} />
              <p className="mt-1 text-xs text-muted">{taxSource === "record" ? "From public property records" : taxSource === "manual" ? "Your number" : `Estimated for ${f.state ? STATE_NAMES[f.state as keyof typeof STATE_NAMES] : "the state"}`}</p>
            </div>
            <div>
              <Label htmlFor="ic-ins">Insurance per year</Label>
              <MoneyInput id="ic-ins" name="insuranceAnnual" value={f.insuranceAnnualCents ?? null} onChange={(v) => set("insuranceAnnualCents", v)} placeholder={est ? usd(est.insuranceAnnualCents).replace("$", "") : "est. from state"} />
            </div>
            <div><Label htmlFor="ic-hoa">HOA per month</Label><MoneyInput id="ic-hoa" name="hoaMonthly" value={f.hoaMonthlyCents ?? null} onChange={(v) => set("hoaMonthlyCents", v ?? 0)} placeholder="0" /></div>
            <div>
              <Label htmlFor="ic-use">How you'll rent it</Label>
              <Select id="ic-use" name="use" value={f.use} onChange={(e) => set("use", e.target.value as CheckForm["use"])}><option value="LTR">Long-term rental</option><option value="STR">Short-term rental</option></Select>
            </div>
            <div>
              <Label htmlFor="ic-product">Loan type</Label>
              <Select id="ic-product" name="product" value={f.product} onChange={(e) => set("product", e.target.value)}>{PRODUCTS.map((x) => <option key={x} value={x}>{t.productShort[x]}</option>)}</Select>
            </div>
            <div>
              <Label htmlFor="ic-prepay">Prepayment penalty</Label>
              <Select id="ic-prepay" name="prepay" value={f.prepay} onChange={(e) => set("prepay", e.target.value)}>{PREPAYS.map((x) => <option key={x} value={x}>{t.prepay[x]}</option>)}</Select>
            </div>
          </div>
          <noscript><button type="submit" className="h-11 w-full rounded-lg bg-ink text-sm font-semibold text-page">{t.check.calculate}</button></noscript>
        </form>
      </Card>

      {/* Results */}
      <div className="space-y-5 lg:sticky lg:top-20 lg:h-fit">
        {a ? (
          <Results
            a={a}
            ctx={p.ctx}
            address={p.listing?.address ?? f.address}
            rentRange={rentSource === "provider" ? rentRange : null}
            basedOn={`${usd(a.valueCents)} ${purchase ? "purchase" : "value"}${purchase ? ` · ${pct(a.downPaymentRatio)} down` : ""} · FICO ${f.fico} · ${rate(a.rateMilli)} · ${t.productShort[a.product]}`}
            onAdjust={() => inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        ) : (
          <Card className="grain flex min-h-72 flex-col items-center justify-center p-8 text-center"><div className="type-hero-numeral text-rule">—.——</div><p className="mt-4 max-w-xs text-sm text-muted">{t.check.placeholder}</p></Card>
        )}
        <div ref={formRef} id="get-estimate">
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-xl text-ink">{p.listing ? t.listing.formTitle : t.check.pdfTitle}</h2>
            <p className="mb-4 mt-1 text-sm text-muted">{p.listing ? t.listing.formBody(p.loFirstName) : t.check.pdfSubtitle}</p>
            <LeadForm
              slug={p.slug}
              source={p.listing ? "SNAPSHOT" : "WIDGET"}
              snapshotToken={p.listing?.token}
              loSlug={p.loSlug}
              companyName={p.companyName}
              loFirstName={p.loFirstName}
              loPhone={p.loPhone}
              privacyPolicyUrl={p.privacyPolicyUrl}
              turnstileSiteKey={p.turnstileSiteKey}
              submitLabel={p.listing ? t.listing.submit : t.check.submit}
              getForm={getForm}
            />
          </Card>
        </div>
      </div>

      {!p.embed && !p.listing && a && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="num font-display text-3xl">{dscr(a.dscrRatio)}</div>
            <VerdictBadge verdict={a.verdict} size="sm" testId="verdict-bar" />
            <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })} className="ml-auto h-10 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent">Get PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

function leverItem(w: DealAnalysis["whatToChange"][number]): Improvement {
  const minus = (x: string) => x.replace(/^-/, "−");
  switch (w.lever) {
    case "RENT":
      return { delta: `+${usd(w.delta)}`, unit: "/mo", label: `Rent at ${usd(w.to)} a month`, hint: t.leverNote.RENT(), stretch: w.stretch };
    case "DOWN_PAYMENT":
      return { delta: `+${usd(w.cashCostCents)}`, label: t.lever.DOWN_PAYMENT(usd(w.to)), hint: t.leverNote.DOWN_PAYMENT(usd(w.cashCostCents)), stretch: w.stretch };
    case "PRICE":
      return { delta: `−${usdMagnitude(w.delta)}`, label: t.lever.PRICE(usd(w.to)), hint: t.leverNote.PRICE(), stretch: w.stretch };
    case "BUYDOWN":
      return { delta: w.rateDeltaMilli != null ? minus(rate(w.rateDeltaMilli)) : points(w.to), label: w.rateMilliTo != null ? `A rate of ${rate(w.rateMilliTo)}` : t.lever.BUYDOWN(points(w.to)), hint: `${points(w.to)} · ${t.leverNote.BUYDOWN(usd(w.cashCostCents))}`, stretch: w.stretch };
    case "CASH_OUT":
      return { delta: `−${usdMagnitude(w.delta)}`, label: t.lever.CASH_OUT(usd(w.to)), hint: t.leverNote.CASH_OUT(), stretch: w.stretch };
    case "PAYDOWN":
      return { delta: `+${usd(w.cashCostCents)}`, label: t.lever.PAYDOWN(usd(w.to)), hint: t.leverNote.PAYDOWN(usd(w.cashCostCents)), stretch: w.stretch };
  }
}

function Results({ a, ctx, address, basedOn, onAdjust, rentRange }: { a: DealAnalysis; ctx: EngineContext; address?: string; basedOn: string; onAdjust: () => void; rentRange: [number, number] | null }) {
  const purchase = a.mode === "PURCHASE";
  const strong = ctx.grid.strongDscrRatio;
  const items = a.whatToChange.slice(0, 4).map(leverItem);
  return (
    <div className="space-y-8" aria-live="polite" data-testid="results">
      <ResultHero address={address || null} value={a.dscrRatio} verdict={a.verdict} min={ctx.grid.minDscrRatio} strong={strong} explanation={t.verdictHelp[a.verdict]} />

      <div className="flex items-start justify-between gap-4 border-b border-rule pb-4">
        <div>
          <Eyebrow>Based on</Eyebrow>
          <p className="mt-1 text-ink">{basedOn}</p>
        </div>
        <button type="button" onClick={onAdjust} className="shrink-0 font-semibold text-ink underline underline-offset-4">Adjust</button>
      </div>

      <section aria-labelledby="ic-numbers">
        <SectionTitle n="01" id="ic-numbers">The numbers</SectionTitle>
        <div className="mt-2">
          <DataRow label="Estimated rent" hint={rentRange ? `Likely range ${usd(rentRange[0])} to ${usd(rentRange[1])}. ${t.check.rentNote}` : t.check.rentNote} value={usd(a.qualifyingRentCents)} />
          <DataRow
            label="Monthly payment"
            hint={`${a.postIoPiCents ? "Interest-only" : "Principal and interest"} ${usd(a.piCents)} · taxes ${usd(a.taxesMonthlyCents)}${a.taxSource === "STATE_DEFAULT" ? " (est.)" : ""} · insurance ${usd(a.insuranceMonthlyCents)} · HOA ${usd(a.hoaMonthlyCents)}`}
            value={usd(a.pitiaCents)}
          />
          {a.postIoPitiaCents ? <DataRow label="After the interest-only years" hint="Principal starts being repaid" value={usd(a.postIoPitiaCents)} /> : null}
          <DataRow label="Monthly cash flow" hint="Rent less the full payment, before repairs and vacancy." value={usdSigned(a.cashFlowCents)} tone={a.cashFlowCents >= 0 ? "accent" : "negative"} />
        </div>
      </section>

      {items.length > 0 && (
        <section aria-labelledby="ic-paths" data-testid="what-to-change">
          <SectionTitle n="02" id="ic-paths">{a.verdict === "BORDERLINE" ? `Ways to reach ${dscr(strong)}` : "What would change the outcome"}</SectionTitle>
          <p className="type-body-small mb-3 mt-1 text-muted">Any one of these is enough. Simplest path first.</p>
          <ImprovementList items={items} stretchLabel={t.stretch} />
        </section>
      )}

      {a.reasons.length > 0 && (
        <ul className="space-y-1 text-sm text-ink-2">
          {a.reasons.map((r) => <li key={r}>{t.reason[r]}</li>)}
        </ul>
      )}

      <Panel aria-labelledby="ic-supports">
        <Eyebrow>
          <span id="ic-supports">What this property supports</span>
        </Eyebrow>
        <div className="mt-2 divide-y divide-rule">
          <Metric label="Maximum loan" hint="Under this broker's program defaults" value={usd(a.maxLoanCents)} testId="max-loan" />
          {purchase ? (
            <Metric label="Total cash needed" hint={`Cash to close ${usd(a.cashToCloseCents)} (down payment, costs, prepaids) + reserves`} value={usd(a.totalCashNeededCents)} testId="cash-needed" />
          ) : (
            <Metric label="Cash to you" hint="After paying off the current loan and closing costs" value={usd(a.cashToBorrowerCents)} testId="cash-needed" />
          )}
          <Metric label="Reserves to show" hint={`${ctx.grid.reservesMonths} months of payments`} value={usd(a.reservesCents)} />
        </div>
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-sm font-medium text-ink-2">
            Full breakdown
            <svg viewBox="0 0 24 24" className="icon h-4 w-4 transition group-open:rotate-180" fill="none" stroke="currentColor" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <dl className="space-y-1.5 pb-2 text-sm">
            {([
              ["Loan amount", `${usd(a.loanAmountCents)} · ${pct(a.ltvRatio)} LTV`],
              ["Estimated rate", `${rate(a.rateMilli)} · ${t.productShort[a.product]}`],
              ...(purchase
                ? ([
                    ["Down payment", usd(a.downPaymentCents)],
                    ["Closing costs (est.)", usd(a.closingCostsCents)],
                    ["Prepaids & escrow (est.)", usd(a.prepaidsCents)],
                  ] as [string, string][])
                : []),
              ["Total PITIA", usd(a.pitiaCents, { cents: true })],
            ] as [string, string][]).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="num text-right">{v}</dd></div>)}
          </dl>
        </details>
      </Panel>
      <p className="type-fine text-muted">{t.check.estimateOnly}</p>
    </div>
  );
}
