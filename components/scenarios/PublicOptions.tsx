"use client";

import { useState } from "react";
import { Badge, Button, Card, cx } from "@/components/ui";

export interface OptionView {
  id: string;
  label: string;
  headline: string;
  tags: string[];
  recommended: boolean;
  pitia: string;
  dscr: string;
  meetsMin: boolean;
  cashFlow: string;
  cashFlowPositive: boolean;
  rows: [string, string][];
  prepayExplainer: string;
  breakEven: string | null;
  postIo: string | null;
}

/**
 * Option details. Mobile: segmented tabs (one option at a time, no sideways scrolling).
 * Desktop: all options side by side. Handles "I'm interested" (and changing your mind).
 */
export function PublicOptions({
  options,
  endpoint,
  initialChosen,
  brokerFirstName,
  phone,
  minDscr,
}: {
  options: OptionView[];
  endpoint: string;
  initialChosen: string | null;
  brokerFirstName: string;
  phone: string | null;
  minDscr: string;
}) {
  const [tab, setTab] = useState(options.find((o) => o.recommended)?.id ?? options[0]!.id);
  const [chosen, setChosen] = useState(initialChosen);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function choose(id: string) {
    setSending(id);
    setError(false);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: id }) });
      if (!res.ok) throw new Error();
      setChosen(id);
    } catch {
      setError(true);
    } finally {
      setSending(null);
    }
  }

  const tel = phone?.replace(/[^\d+]/g, "");
  const anyRecommended = options.some((o) => o.recommended);
  const chosenLabel = options.find((o) => o.id === chosen)?.label;

  return (
    <div>
      {/* Mobile tabs */}
      <div role="tablist" aria-label="Loan options" className="sticky top-[61px] z-20 -mx-4 mb-4 flex gap-1 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur sm:hidden">
        {options.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={tab === o.id}
            onClick={() => setTab(o.id)}
            className={cx("flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition", tab === o.id ? "bg-accent text-on-accent shadow-sm" : "bg-white text-ink-2 ring-1 ring-line")}
          >
            Option {o.label}
            {o.recommended && <span className="ml-1">★</span>}
            {chosen === o.id && <span className="ml-1">✓</span>}
          </button>
        ))}
      </div>

      <div className={cx("grid gap-4", options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((o) => (
          <Card
            key={o.id}
            data-testid="option-card"
            className={cx("flex-col overflow-hidden", tab === o.id ? "flex" : "hidden sm:flex", o.recommended && "ring-2 ring-[color:var(--accent)]")}
          >
            {o.recommended ? (
              <div className="bg-accent px-5 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-on-accent">{brokerFirstName}&apos;s recommendation</div>
            ) : anyRecommended ? (
              // Keeps rows aligned across cards on desktop.
              <div className="hidden py-1.5 text-xs sm:block" aria-hidden>&nbsp;</div>
            ) : null}
            <div className="border-b border-line p-5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-display text-2xl">Option {o.label}</div>
                <div className="text-right text-sm text-muted">{o.headline}</div>
              </div>
              <div className="mt-1.5 flex min-h-6 flex-wrap gap-1">{o.tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}</div>
              <div className="mt-4 text-xs text-muted">Monthly payment (PITIA)</div>
              <div className="num font-display text-4xl text-ink">{o.pitia}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", o.meetsMin ? "bg-good-soft text-good" : "bg-warn-soft text-warn")}>
                  DSCR {o.dscr} {o.meetsMin ? "✓" : `· below ${minDscr}`}
                </span>
                <span className="text-ink-2">
                  Cash flow <span className={cx("num font-semibold", o.cashFlowPositive ? "text-good" : "text-bad")}>{o.cashFlow}/mo</span>
                </span>
              </div>
            </div>
            <dl className="flex-1 space-y-2 p-5 text-sm">
              {o.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-2 px-5 pb-4 text-xs leading-relaxed text-muted">
              {o.breakEven && <p className="rounded-lg bg-accent-soft px-3 py-2 text-accent-deep">{o.breakEven}</p>}
              {o.postIo && <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">{o.postIo}</p>}
              <p><span className="font-medium text-ink-2">Prepayment:</span> {o.prepayExplainer}</p>
            </div>
            <div className="mt-auto p-5 pt-0">
              {chosen === o.id ? (
                <div className="rounded-xl bg-good-soft px-3 py-2.5 text-center text-sm font-medium text-good" role="status">
                  ✓ You picked Option {o.label}. {brokerFirstName} has been notified.
                </div>
              ) : (
                <Button variant={o.recommended || !chosen ? "accent" : "secondary"} size="lg" className="w-full" disabled={sending !== null} onClick={() => choose(o.id)}>
                  {sending === o.id ? "Sending…" : chosen ? `Switch to Option ${o.label}` : `I'm interested in Option ${o.label}`}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-bad" role="alert">That didn&apos;t go through. Please try again, or call {brokerFirstName} directly.</p>}

      {chosen && (
        <div className="mt-5 animate-rise rounded-2xl border border-line bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <div className="font-semibold text-ink">Great choice: Option {chosenLabel}</div>
            <p className="mt-0.5 text-sm text-muted">{brokerFirstName} will reach out to confirm pricing and send a short document checklist. Want to talk sooner?</p>
          </div>
          {tel && (
            <div className="mt-3 flex gap-2 sm:mt-0">
              <a href={`tel:${tel}`} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent">Call {brokerFirstName}</a>
              <a href={`sms:${tel}?&body=${encodeURIComponent(`Hi ${brokerFirstName}, I'd like to move forward with Option ${chosenLabel}.`)}`} className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink">Text</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
