"use client";

import { useState, type ReactNode } from "react";
import { dscr, rate, usd, usdSigned } from "@/lib/format";
import { meterPercent } from "@/lib/charts/meter";
import { useTheme } from "../ThemeContext";

export interface CompareOption {
  id: string;
  label: string;
  /** Short tag ("No points", "Highest cash flow", "Lowest rate"). */
  tag: string | null;
  recommended: boolean;
  rateMilli: number;
  productLong: string;
  productShort: string;
  pitiaCents: number;
  dscrRatio: number | null;
  cashFlowCents: number;
  pointsLabel: string;
  pointsCostCents: number;
  prepayShort: string;
  postIoPitiaCents: number | null;
  note: string;
}

export interface OptionCompareProps {
  options: CompareOption[];
  picked: string | null;
  min: number;
  strong: number;
  /** Details panel for an option (prepay table, breakdown). */
  details: (o: CompareOption) => ReactNode;
  /** The "I'm interested" action (button or question form) for an option. */
  action: (o: CompareOption, emphasis: "primary" | "secondary" | "on-block") => ReactNode;
  open: string | null;
  onToggle: (id: string) => void;
}

function DetailsToggle({ o, open, onToggle, className = "" }: { o: CompareOption; open: boolean; onToggle: (id: string) => void; className?: string }) {
  return (
    <button type="button" onClick={() => onToggle(o.id)} aria-expanded={open} className={`flex w-full items-center justify-between py-3 text-sm font-medium ${className}`}>
      {open ? "Hide details" : "See details"}
      <svg viewBox="0 0 24 24" className={`icon h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

function Metrics({ o, ruled }: { o: CompareOption; ruled: boolean }) {
  const cell = ruled ? "border-t border-current/40 pt-2" : "";
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
      {([
        ["Monthly payment", usd(o.pitiaCents)],
        ["Coverage (DSCR)", dscr(o.dscrRatio)],
        ["Monthly cash flow", usdSigned(o.cashFlowCents)],
        ["Points at closing", o.pointsCostCents ? `${o.pointsLabel} · ${usd(o.pointsCostCents)}` : "None"],
      ] as const).map(([k, v]) => (
        <div key={k} className={cell}>
          <dt className="type-body-small opacity-80">{k}</dt>
          <dd className="type-metric-panel num">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Theme-branching (DESIGN.md §6): maison stacked cards · terminal comparison table · atelier full-width sections. */
export function OptionCompare(p: OptionCompareProps) {
  const { variants } = useTheme();
  const initial = p.picked ?? p.options.find((o) => o.recommended)?.id ?? p.options[0]!.id;
  const [selected, setSelected] = useState(initial);

  if (variants.options === "table") {
    const sel = p.options.find((o) => o.id === selected) ?? p.options[0]!;
    const rows: [string, (o: CompareOption) => ReactNode, boolean?][] = [
      ["Rate", (o) => rate(o.rateMilli)],
      ["Type", (o) => o.productShort],
      ["Payment", (o) => usd(o.pitiaCents)],
      ["DSCR", (o) => dscr(o.dscrRatio), true],
      ["Cash flow", (o) => usdSigned(o.cashFlowCents)],
      ["Points", (o) => o.pointsLabel],
      ["Points cost", (o) => usd(o.pointsCostCents)],
      ["Prepay", (o) => o.prepayShort],
      ["Later payment", (o) => (o.postIoPitiaCents ? usd(o.postIoPitiaCents) : "same")],
    ];
    const col = (o: CompareOption) => (o.id === selected ? "bg-surface-alt" : "");
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-rule bg-surface">
          <table className="w-full min-w-80 text-sm">
            <thead>
              <tr>
                <th scope="col" className="p-3 text-left font-normal text-muted">Option</th>
                {p.options.map((o) => (
                  <th key={o.id} scope="col" data-testid={`option-${o.label}`} className={`p-3 text-right ${col(o)} ${o.id === selected ? "border-t-2 border-accent" : "border-t-2 border-transparent"}`}>
                    <span className="block font-mono text-xl font-medium text-ink">{o.label}</span>
                    <span className="type-eyebrow block text-muted">{o.tag ?? (o.recommended ? "Recommended" : "")}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, fn, big]) => (
                <tr key={k} className="border-t border-rule">
                  <th scope="row" className="p-3 text-left font-normal text-muted">{k}</th>
                  {p.options.map((o) => (
                    <td key={o.id} className={`num p-3 text-right font-mono ${big ? "text-xl font-medium" : ""} ${big && o.id === selected ? "text-accent" : "text-ink"} ${col(o)}`}>{fn(o)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="rounded-2xl border border-rule bg-surface p-4" aria-label="Coverage against the tiers">
          <div className="type-eyebrow text-muted">Coverage against the tiers</div>
          <div className="mt-3 space-y-2">
            {p.options.map((o) => (
              <div key={o.id} className="flex items-center gap-3">
                <span className="w-4 font-mono text-ink">{o.label}</span>
                <div className="relative h-3 flex-1 rounded-sm bg-surface-alt">
                  <div className={`absolute inset-y-0 left-0 rounded-sm ${o.id === selected ? "bg-accent" : "bg-dim"}`} style={{ width: meterPercent(o.dscrRatio) }} />
                  {[p.min, p.strong].map((t) => <div key={t} className="absolute -inset-y-1 w-px bg-ink" style={{ left: meterPercent(t) }} />)}
                </div>
                <span className="num w-10 text-right font-mono text-ink">{dscr(o.dscrRatio)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-ink-2">{sel.note}</p>
        </section>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${p.options.length}, minmax(0, 1fr))` }} role="group" aria-label="Choose an option">
          {p.options.map((o) => (
            <button key={o.id} type="button" aria-pressed={o.id === selected} onClick={() => setSelected(o.id)} className={`h-14 rounded-[var(--radius-control)] border font-mono text-ink ${o.id === selected ? "border-accent bg-surface-alt" : "border-rule bg-surface"}`}>
              {o.label}
            </button>
          ))}
        </div>
        {p.action(sel, "primary")}
        <div className="rounded-2xl border border-rule bg-surface px-4">
          <DetailsToggle o={sel} open={p.open === sel.id} onToggle={p.onToggle} className="text-ink-2" />
          {p.open === sel.id && <div className="pb-4" data-testid={`details-${sel.label}`}>{p.details(sel)}</div>}
        </div>
      </div>
    );
  }

  if (variants.options === "sections") {
    return (
      <div className="-mx-[var(--space-page)] sm:mx-0">
        {p.options.map((o) => {
          const block = o.recommended;
          return (
            <article key={o.id} data-testid={`option-${o.label}`} className={`px-[var(--space-page)] py-8 sm:px-8 ${block ? "bg-accent text-on-accent" : "border-b-2 border-ink text-ink"}`}>
              <div className="flex items-start gap-4">
                <span className="type-option-letter" aria-hidden>{o.label}</span>
                <div className="min-w-0 pt-2">
                  <div className={`type-eyebrow ${block ? "text-on-accent" : "text-accent"}`}>Option {o.label}{o.tag ? ` · ${o.tag}` : ""}</div>
                  <div className="type-option-rate num">{rate(o.rateMilli)}</div>
                  <div className="opacity-90">{o.productLong}</div>
                </div>
              </div>
              <Metrics o={o} ruled />
              <p className="mt-4 opacity-90">{o.note}</p>
              <div className={`mt-4 border-t ${block ? "border-on-accent/40" : "border-ink"}`}>
                <DetailsToggle o={o} open={p.open === o.id} onToggle={p.onToggle} />
                {p.open === o.id && <div className="pb-4" data-testid={`details-${o.label}`}>{p.details(o)}</div>}
              </div>
              <div className="mt-2">{p.action(o, block ? "on-block" : "secondary")}</div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {p.options.map((o) => {
        const inv = o.recommended;
        return (
          <article key={o.id} data-testid={`option-${o.label}`} className={`border p-6 ${inv ? "-mx-[var(--space-page)] border-inverse bg-inverse px-[var(--space-page)] text-on-inverse sm:mx-0 sm:px-6" : "border-rule bg-surface text-ink"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="type-option-letter">Option {o.label}</h2>
              {(o.tag || o.recommended) && <span className={`type-eyebrow ${inv ? "text-on-inverse-muted" : "text-accent"}`}>{o.tag ?? "Recommended"}</span>}
            </div>
            <div className="type-option-rate num mt-3">{rate(o.rateMilli)}</div>
            <div className={inv ? "text-on-inverse-muted" : "text-ink-2"}>{o.productLong}</div>
            <Metrics o={o} ruled={false} />
            <p className={`mt-5 border-t pt-4 ${inv ? "border-inverse-rule text-on-inverse-muted" : "border-rule text-ink-2"}`}>{o.note}</p>
            <div className={`border-b ${inv ? "border-inverse-rule" : "border-rule"}`}>
              <DetailsToggle o={o} open={p.open === o.id} onToggle={p.onToggle} />
              {p.open === o.id && <div className="pb-4" data-testid={`details-${o.label}`}>{p.details(o)}</div>}
            </div>
            <div className="mt-4">{p.action(o, inv ? "on-block" : "secondary")}</div>
          </article>
        );
      })}
    </div>
  );
}
