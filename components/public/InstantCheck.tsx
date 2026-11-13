"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { analyzeDeal, estimateEscrow, FICO_BUCKETS, PREPAYS, PRODUCTS, PROPERTY_TYPES, US_STATES, STATE_NAMES, type DealAnalysis, type EngineContext, type UsState } from "@/lib/dscr";
import { isAnalyzable, isSubmittable, toDealInput, type CheckForm } from "@/lib/check/form";
import { normalizeAddress } from "@/lib/providers/address";
import { dscr, pct, points, rate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { Badge, Card, cx, Input, Label, Select } from "@/components/ui";
import { DscrGauge } from "./DscrGauge";
import { LeadForm } from "./LeadForm";
import { MoneyInput } from "./MoneyInput";

const VERDICT_STYLE = { STRONG: "bg-good-soft text-good", BORDERLINE: "bg-warn-soft text-warn", NEEDS_ADJUSTMENT: "bg-warn-soft text-warn", NOT_ELIGIBLE: "bg-bad-soft text-bad" } as const;
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
      <Card className="h-fit p-5 sm:p-6">
        <form method="get" onSubmit={(e) => e.preventDefault()} className="space-y-5" aria-label="Deal details">
          {p.loSlug && <input type="hidden" name="lo" value={p.loSlug} />}
          {!p.listing && (
            <div role="radiogroup" aria-label="Loan purpose" className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1">
              {(["PURCHASE", "CASH_OUT"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={f.mode === m} onClick={() => set("mode", m)} className={cx("h-10 rounded-lg text-sm font-semibold transition", f.mode === m ? "bg-white text-ink shadow-sm" : "text-ink-2")}>
                  {m === "PURCHASE" ? "Buying" : "Cash-out refi"}
                </button>
              ))}
              <input type="hidden" name="mode" value={f.mode} />
            </div>
          )}
          {!p.listing && (
            <div>
              <Label htmlFor="ic-address">Property address</Label>
              <Input id="ic-address" name="address" value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, Austin, TX 78704" autoComplete="street-address" className="h-12 rounded-xl text-[17px]" />
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
                    <button key={d} type="button" onClick={() => set("downPaymentRatio", d)} className={cx("h-9 flex-1 rounded-lg border text-sm transition", f.downPaymentRatio === d ? "border-accent bg-accent-soft font-semibold text-accent-deep" : "border-line bg-white text-ink-2 hover:bg-paper")}>{pct(d)}</button>
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
          <noscript><button type="submit" className="h-11 w-full rounded-lg bg-ink text-sm font-semibold text-white">{t.check.calculate}</button></noscript>
        </form>
      </Card>

      {/* Results */}
      <div className="space-y-5 lg:sticky lg:top-20 lg:h-fit">
        {a ? <Results a={a} ctx={p.ctx} /> : <Card className="grain flex min-h-[300px] flex-col items-center justify-center p-8 text-center"><div className="font-display text-5xl text-line">—.——</div><p className="mt-4 max-w-xs text-sm text-muted">{t.check.placeholder}</p></Card>}
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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="num font-display text-3xl">{dscr(a.dscrRatio)}</div>
            <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", VERDICT_STYLE[a.verdict])}>{t.verdict[a.verdict]}</span>
            <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })} className="ml-auto h-10 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent">Get PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Results({ a, ctx }: { a: DealAnalysis; ctx: EngineContext }) {
  const purchase = a.mode === "PURCHASE";
  const best = a.whatToChange[0];
  const others = a.whatToChange.slice(1, 4);
  const leverTitle = (w: DealAnalysis["whatToChange"][number]) => t.lever[w.lever](w.lever === "BUYDOWN" ? points(w.to) : usd(w.to));
  return (
    <Card className="overflow-hidden" aria-live="polite" data-testid="results">
      <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-6 sm:flex-row sm:gap-6 sm:px-6">
        <DscrGauge value={a.dscrRatio} verdict={a.verdict} minRatio={ctx.grid.minDscrRatio} strongRatio={ctx.grid.strongDscrRatio} />
        <div className="text-center sm:text-left">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Estimated DSCR</div>
          <div className="num font-display text-6xl leading-none text-ink" data-testid="dscr-value">{dscr(a.dscrRatio)}</div>
          <span className={cx("mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold", VERDICT_STYLE[a.verdict])} data-testid="verdict">{t.verdict[a.verdict]}</span>
          <p className="mt-1.5 max-w-xs text-xs text-muted">{t.verdictHelp[a.verdict]}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-line">
        <div className="border-r border-line p-4 sm:p-5">
          <div className="text-xs text-muted">Estimated payment</div>
          <div className="num mt-1 text-2xl font-semibold">{usd(a.pitiaCents)}<span className="text-sm font-normal text-muted">/mo</span></div>
          <div className="text-xs text-muted">{rate(a.rateMilli)} · {t.productShort[a.product]}</div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs text-muted">Cash flow</div>
          <div className={cx("num mt-1 text-2xl font-semibold", a.cashFlowCents >= 0 ? "text-good" : "text-bad")}>{usd(a.cashFlowCents)}<span className="text-sm font-normal text-muted">/mo</span></div>
          <div className="text-xs text-muted">Rent {usd(a.qualifyingRentCents)} − payment</div>
        </div>
        <div className="border-r border-t border-line p-4 sm:p-5">
          <div className="text-xs text-muted">{purchase ? "Total cash needed" : "Cash to you"}</div>
          <div className="num mt-1 text-2xl font-semibold" data-testid="cash-needed">{purchase ? usd(a.totalCashNeededCents) : usd(a.cashToBorrowerCents)}</div>
          <div className="text-xs text-muted">{purchase ? `incl. ${usd(a.reservesCents)} reserves` : `${usd(a.reservesCents)} reserves needed`}</div>
        </div>
        <div className="border-t border-line p-4 sm:p-5">
          <div className="text-xs text-muted">Max loan (program defaults)</div>
          <div className="num mt-1 text-2xl font-semibold" data-testid="max-loan">{usd(a.maxLoanCents)}</div>
          <div className="text-xs text-muted">This deal: {usd(a.loanAmountCents)} · {pct(a.ltvRatio)} LTV</div>
        </div>
      </div>
      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-ink-2">
          Payment and cash breakdown
          <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <dl className="space-y-1.5 px-5 pb-4 text-sm">
          {([
            [a.postIoPiCents ? "Interest-only payment" : "Principal & interest", a.piCents],
            [`Taxes${a.taxSource === "STATE_DEFAULT" ? " (state estimate)" : ""}`, a.taxesMonthlyCents],
            [`Insurance${a.insuranceSource === "STATE_DEFAULT" ? " (state estimate)" : ""}`, a.insuranceMonthlyCents],
            ["HOA", a.hoaMonthlyCents],
          ] as [string, number][]).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="num">{usd(v, { cents: true })}</dd></div>)}
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>Total PITIA</dt><dd className="num">{usd(a.pitiaCents, { cents: true })}</dd></div>
          {a.postIoPitiaCents && <div className="flex justify-between text-muted"><dt>After interest-only period</dt><dd className="num">{usd(a.postIoPitiaCents)}</dd></div>}
          {purchase && (
            <>
              <div className="flex justify-between pt-2 text-muted"><dt>Down payment</dt><dd className="num">{usd(a.downPaymentCents)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Closing costs (est.)</dt><dd className="num">{usd(a.closingCostsCents)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Prepaids & escrow (est.)</dt><dd className="num">{usd(a.prepaidsCents)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Reserves ({ctx.grid.reservesMonths} months)</dt><dd className="num">{usd(a.reservesCents)}</dd></div>
            </>
          )}
        </dl>
      </details>
      {best && (
        <div className="border-t border-line bg-paper/70 px-5 py-4" data-testid="what-to-change">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">{a.verdict === "BORDERLINE" ? "To look strong" : "What would change it"}</div>
          <div className="mt-2 rounded-xl border border-accent-line bg-white p-3">
            <div className="text-xs font-semibold text-accent">Simplest path</div>
            <div className="font-semibold text-ink">{leverTitle(best)}</div>
            <div className="text-sm text-muted">{t.leverNote[best.lever](usd(best.cashCostCents))}</div>
          </div>
          {others.length > 0 && (
            <ul className="mt-3 space-y-2">
              {others.map((w) => (
                <li key={w.lever} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><span><strong className="font-medium text-ink">{leverTitle(w)}</strong> <span className="text-muted">{t.leverNote[w.lever](usd(w.cashCostCents))}</span>{w.stretch && <Badge className="ml-1">{t.stretch}</Badge>}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {a.reasons.length > 0 && (
        <ul className="space-y-1 border-t border-line px-5 py-3 text-xs text-ink-2">
          {a.reasons.map((r) => <li key={r}>• {t.reason[r]}</li>)}
        </ul>
      )}
      <p className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-muted">{t.check.estimateOnly}</p>
    </Card>
  );
}
