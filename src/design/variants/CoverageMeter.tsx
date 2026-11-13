"use client";

import { arcPath, arcPoint, meterPosition } from "@/lib/charts/meter";
import { dscr } from "@/lib/format";
import { useTheme } from "../ThemeContext";

/**
 * One of the six theme-branching components (DESIGN.md §6).
 * maison: 1px linear track · terminal: semicircle gauge · atelier: 2px outlined block bar.
 * `form` forces a shape (terminal uses linear in PDFs and dashboards).
 */
export function CoverageMeter({ value, min, strong, onBlock = false, form, children }: { value: number | null; min: number; strong: number; onBlock?: boolean; form?: "linear" | "gauge"; children?: React.ReactNode }) {
  const { variants } = useTheme();
  const kind = form === "linear" ? (variants.meter === "linear-block" ? "linear-block" : "linear") : variants.meter;
  const pos = meterPosition(value);
  const pMin = meterPosition(min);
  const pStrong = meterPosition(strong);
  const label = `DSCR ${dscr(value)} on a scale where ${dscr(min)} is the minimum and ${dscr(strong)} is the strong tier`;

  if (kind === "gauge") {
    const tick = (p: number) => {
      const a = arcPoint(p, 112);
      const b = arcPoint(p, 138);
      return { a, b, t: arcPoint(p, 152) };
    };
    const t1 = tick(pMin);
    const t2 = tick(pStrong);
    return (
      <div className="relative mx-auto w-full max-w-[310px]" role="img" aria-label={label}>
        <svg viewBox="0 0 310 160" className="w-full" aria-hidden>
          <path d={arcPath(0, 1)} className="stroke-rule-strong" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d={arcPath(0, Math.max(0.001, pos))} className="stroke-accent" strokeWidth="10" fill="none" strokeLinecap="round" />
          {[t1, t2].map((t, i) => (
            <g key={i}>
              <line x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} className="stroke-ink" strokeWidth="2" />
            </g>
          ))}
        </svg>
        <span className="type-eyebrow absolute text-muted" style={{ left: `${(t1.t.x / 310) * 100}%`, top: `${(t1.t.y / 160) * 100}%`, transform: "translate(-50%,-50%)" }}>{dscr(min)}</span>
        <span className="type-eyebrow absolute text-muted" style={{ left: `${(t2.t.x / 310) * 100}%`, top: `${(t2.t.y / 160) * 100}%`, transform: "translate(-50%,-50%)" }}>{dscr(strong)}</span>
        <div className="absolute inset-x-0 bottom-0 flex justify-center">{children}</div>
      </div>
    );
  }

  const block = kind === "linear-block";
  return (
    <div role="img" aria-label={label} className="w-full">
      <div className={block ? (onBlock ? "relative h-4 border-2 border-on-accent" : "relative h-4 border-2 border-ink") : "relative h-6"}>
        {block ? (
          <div className={`absolute inset-y-0 left-0 ${onBlock ? "bg-on-accent" : "bg-ink"}`} style={{ width: `${pos * 100}%` }} />
        ) : (
          <>
            <div className={`absolute inset-x-0 top-1/2 h-px ${onBlock ? "bg-on-inverse-muted" : "bg-rule-strong"} opacity-60`} />
            <div className={`absolute left-0 top-1/2 h-0.5 -translate-y-1/2 ${onBlock ? "bg-on-inverse" : "bg-ink"}`} style={{ width: `${pos * 100}%` }} />
            <div className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${onBlock ? "bg-on-inverse" : "bg-accent"}`} style={{ left: `${pos * 100}%` }} />
          </>
        )}
        {[pMin, pStrong].map((p, i) => (
          <div key={i} className={`absolute ${block ? "-bottom-2 h-3" : "top-1/2 h-3 -translate-y-1/2"} w-px ${onBlock ? (block ? "bg-on-accent" : "bg-on-inverse") : "bg-ink"}`} style={{ left: `${p * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-2 h-4">
        <span className={`type-eyebrow absolute -translate-x-1/2 ${onBlock ? (block ? "text-on-accent" : "text-on-inverse-muted") : "text-muted"}`} style={{ left: `${pMin * 100}%` }}>{dscr(min)}</span>
        <span className={`type-eyebrow absolute -translate-x-1 whitespace-nowrap ${onBlock ? (block ? "text-on-accent" : "text-on-inverse-muted") : "text-muted"}`} style={{ left: `${pStrong * 100}%` }}>{dscr(strong)}{block ? "" : " · strong tier"}</span>
      </div>
    </div>
  );
}
