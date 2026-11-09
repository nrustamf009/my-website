"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeDeal, FICO_RANGES, VERDICT_LABEL, type BrokerDefaults, type DealAnalysis, type FicoRange } from "@/lib/dscr";
import { pct, rate, ratio, usd } from "@/lib/format";
import { Badge, Card, cx, Input, Label, Select } from "@/components/ui";
import { DscrGauge } from "./DscrGauge";
import { LeadCaptureForm, type DealPayload } from "./LeadCaptureForm";
import { MoneyInput } from "./MoneyInput";

type RentSource = "rentcast" | "mock" | "manual" | null;

const VERDICT_STYLE = {
  LIKELY: "bg-good-soft text-good",
  BORDERLINE: "bg-warn-soft text-warn",
  UNLIKELY: "bg-bad-soft text-bad",
} as const;

const DOWN_CHIPS = [0.2, 0.25, 0.3, 0.35];

export function InstantCheck({ slug, brokerFirstName, brokerPhone, defaults, embed = false }: { slug: string; brokerFirstName: string; brokerPhone?: string | null; defaults: BrokerDefaults; embed?: boolean }) {
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [down, setDown] = useState(0.25);
  const [fico, setFico] = useState<FicoRange>("720-759");
  const [rent, setRent] = useState<number | null>(null);
  const [rentSource, setRentSource] = useState<RentSource>(null);
  const [rentRange, setRentRange] = useState<[number, number] | null>(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [ratePct, setRatePct] = useState(defaults.defaultRate);
  const [io, setIo] = useState(false);
  const [hoa, setHoa] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Prefill rent from the estimate provider when address/price settle (unless the user typed rent).
  useEffect(() => {
    if (rentSource === "manual" || address.trim().length < 8 || !/\d/.test(address)) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setRentLoading(true);
      try {
        const qs = new URLSearchParams({ slug, address, ...(price ? { price: String(price) } : {}) });
        const res = await fetch(`/api/rent-estimate?${qs}`, { signal: ctrl.signal });
        const data = await res.json();
        if (data.estimate) {
          setRent(data.estimate.rent);
          setRentSource(data.estimate.provider);
          setRentRange(data.estimate.rentLow && data.estimate.rentHigh ? [data.estimate.rentLow, data.estimate.rentHigh] : null);
        }
      } catch {
        /* user can type rent */
      } finally {
        setRentLoading(false);
      }
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [address, price, rentSource, slug]);

  // Embedded mode: report height to the parent page so the iframe can auto-size.
  useEffect(() => {
    if (!embed) return;
    const ro = new ResizeObserver(() => window.parent?.postMessage({ type: "dscr-embed-height", height: document.documentElement.scrollHeight }, "*"));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [embed]);

  const analysis: DealAnalysis | null = useMemo(() => {
    if (!price || price < 10_000 || rent == null) return null;
    try {
      return analyzeDeal({ price, downPaymentPct: down, monthlyRent: rent, fico, ratePct, interestOnly: io, hoaMonthly: hoa ?? 0 }, defaults);
    } catch {
      return null;
    }
  }, [price, down, rent, fico, ratePct, io, hoa, defaults]);

  const deal = (): DealPayload | null =>
    analysis && address.trim().length >= 5 ? { address: address.trim(), price: price!, downPaymentPct: down, monthlyRent: rent!, fico, ratePct, interestOnly: io, hoaMonthly: hoa ?? 0 } : null;

  return (
    <div className={cx("grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8", !embed && "pb-24 lg:pb-0")}>
      {/* Inputs */}
      <Card className="h-fit p-5 sm:p-6">
        <div className="space-y-5">
          <div>
            <Label htmlFor="ic-address">Property address</Label>
            <Input id="ic-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Austin, TX 78704" autoComplete="street-address" className="h-12 rounded-xl text-[17px]" />
          </div>
          <div>
            <Label htmlFor="ic-price">Purchase price</Label>
            <MoneyInput id="ic-price" value={price} onChange={setPrice} placeholder="350,000" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ic-down">Down payment</Label>
              <span className="num text-sm font-semibold text-ink">{pct(down)}{price ? <span className="font-normal text-muted"> · {usd(price * down)}</span> : null}</span>
            </div>
            <input id="ic-down" type="range" min={0.1} max={0.5} step={0.01} value={down} onChange={(e) => setDown(Number(e.target.value))} className="range-accent w-full" />
            <div className="mt-2 flex gap-2">
              {DOWN_CHIPS.map((d) => (
                <button key={d} type="button" onClick={() => setDown(d)} className={cx("h-8 flex-1 rounded-lg border text-sm transition", Math.abs(down - d) < 0.001 ? "border-accent bg-accent-soft font-semibold text-accent-deep" : "border-line bg-white text-ink-2 hover:bg-paper")}>
                  {pct(d)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ic-fico">Approximate credit score</Label>
            <Select id="ic-fico" value={fico} onChange={(e) => setFico(e.target.value as FicoRange)} className="h-12 rounded-xl text-[16px]">
              {FICO_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ic-rent">Expected monthly rent</Label>
              {rentLoading ? (
                <span className="text-xs text-muted">Looking up rent…</span>
              ) : rentSource && rentSource !== "manual" ? (
                <Badge tone="accent">{rentSource === "rentcast" ? "RentCast estimate" : "Estimated (demo data)"}</Badge>
              ) : rentSource === "manual" ? (
                <span className="text-xs text-muted">Your number</span>
              ) : null}
            </div>
            <MoneyInput id="ic-rent" value={rent} onChange={(v) => { setRent(v); setRentSource("manual"); }} placeholder="2,600" suffix="/mo" />
            {rentRange && rentSource !== "manual" && <p className="mt-1 text-xs text-muted">Typical range {usd(rentRange[0])}–{usd(rentRange[1])}. Edit if you know the actual lease.</p>}
          </div>

          <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex w-full items-center justify-between text-sm font-medium text-ink-2">
            Rate, interest-only & HOA
            <svg viewBox="0 0 24 24" className={cx("h-4 w-4 transition", advanced && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {advanced && (
            <div className="grid animate-rise gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ic-rate">Interest rate (%)</Label>
                <Input id="ic-rate" type="number" step="0.125" min={0} max={20} value={ratePct} onChange={(e) => setRatePct(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label htmlFor="ic-hoa">HOA per month</Label>
                <MoneyInput id="ic-hoa" value={hoa} onChange={setHoa} placeholder="0" />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
                <input type="checkbox" checked={io} onChange={(e) => setIo(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Interest-only payment
              </label>
              <p className="text-xs text-muted sm:col-span-2">Taxes ({defaults.taxRatePct}%/yr) and insurance ({defaults.insuranceRatePct}%/yr) are estimated from the price.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      <div className="space-y-5 lg:sticky lg:top-20 lg:h-fit">
        {analysis ? <Results a={analysis} /> : <ResultsPlaceholder />}
        <div ref={formRef} id="get-pdf">
          <Card className="p-5 sm:p-6">
            <h3 className="font-display text-xl text-ink">Get the full PDF analysis</h3>
            <p className="mb-4 mt-1 text-sm text-muted">Payment breakdown, down-payment comparison and next steps, sent to your inbox.</p>
            <LeadCaptureForm slug={slug} source="CHECK" getDeal={deal} brokerFirstName={brokerFirstName} brokerPhone={brokerPhone} />
          </Card>
        </div>
      </div>

      {/* Mobile sticky summary */}
      {!embed && analysis && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="num font-display text-3xl">{ratio(analysis.dscr)}</div>
            <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", VERDICT_STYLE[analysis.verdict])}>{VERDICT_LABEL[analysis.verdict]}</span>
            <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })} className="ml-auto h-10 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent">Get PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsPlaceholder() {
  return (
    <Card className="grain flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
      <div className="font-display text-5xl text-line">—.——</div>
      <p className="mt-4 max-w-xs text-sm text-muted">Enter a price and rent to see your DSCR, monthly payment and how much you could borrow.</p>
    </Card>
  );
}

function Results({ a }: { a: DealAnalysis }) {
  const rows: [string, number][] = [
    [a.interestOnly ? "Interest" : "Principal & interest", a.pi],
    ["Property taxes", a.escrow.taxesMonthly],
    ["Insurance", a.escrow.insuranceMonthly],
    ...(a.escrow.hoaMonthly ? ([["HOA", a.escrow.hoaMonthly]] as [string, number][]) : []),
  ];
  return (
    <Card className="overflow-hidden" aria-live="polite">
      <div className="flex flex-col items-center gap-2 px-5 pb-4 pt-6 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <DscrGauge value={a.dscr} verdict={a.verdict} min={a.minDscr} />
        <div className="text-center sm:text-left">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Estimated DSCR</div>
          <div className="num font-display text-6xl leading-none text-ink" data-testid="dscr-value">{ratio(a.dscr)}</div>
          <span className={cx("mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold", VERDICT_STYLE[a.verdict])} data-testid="verdict">{VERDICT_LABEL[a.verdict]}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-line">
        <div className="border-r border-line p-4 sm:p-5">
          <div className="text-xs text-muted">Monthly payment (PITIA)</div>
          <div className="num mt-1 text-2xl font-semibold">{usd(a.pitia)}</div>
          <div className="text-xs text-muted">{rate(a.ratePct)} · {a.interestOnly ? "interest-only" : `${a.termYears}-yr fixed`}</div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs text-muted">Max loan estimate</div>
          <div className="num mt-1 text-2xl font-semibold" data-testid="max-loan">{usd(a.maxLoan)}</div>
          <div className="text-xs text-muted">Limited by {a.maxLoanLimitedBy === "DSCR" ? "rent" : `${pct(a.maxLtv)} LTV`}</div>
        </div>
      </div>
      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-ink-2">
          Payment breakdown
          <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <dl className="space-y-1.5 px-5 pb-4 text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="num">{usd(v, { cents: true })}</dd></div>)}
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>Total</dt><dd className="num">{usd(a.pitia, { cents: true })}</dd></div>
          <div className="flex justify-between text-muted"><dt>Loan amount ({pct(a.ltv)} LTV)</dt><dd className="num">{usd(a.loanAmount)}</dd></div>
        </dl>
      </details>
      {a.suggestions.length > 0 ? (
        <div className="border-t border-line bg-paper/70 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">What to change to qualify</div>
          <ul className="mt-3 space-y-3">
            {a.suggestions.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-on-accent">{i + 1}</span>
                <div><div className="text-sm font-semibold text-ink">{s.title}</div><div className="text-sm text-muted">{s.detail}</div></div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-t border-line bg-good-soft/60 px-5 py-4 text-sm text-good">
          Rent covers the payment {ratio(a.dscr)}x. Rent could drop to {usd(a.rentForMinDscr)} and still meet DSCR {a.minDscr.toFixed(2)}.
        </div>
      )}
      <p className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-muted">Estimate only, not an offer to lend. Actual terms depend on underwriting, appraisal and lender guidelines.</p>
    </Card>
  );
}
