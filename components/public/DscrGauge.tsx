import type { Verdict } from "@/lib/dscr";

const COLORS: Record<Verdict, string> = { LIKELY: "#157a4a", BORDERLINE: "#a15c07", UNLIKELY: "#b42318" };

/** Semicircle gauge from 0.50 to 1.75. Display-only mapping, no financial math. */
export function DscrGauge({ value, verdict, min }: { value: number | null; verdict: Verdict; min: number }) {
  const lo = 0.5;
  const hi = 1.75;
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
  const angle = (v: number) => Math.PI * (1 - (clamp(v) - lo) / (hi - lo));
  const pt = (v: number, r: number) => [100 + r * Math.cos(angle(v)), 100 - r * Math.sin(angle(v))] as const;
  const arc = (a: number, b: number, r: number) => {
    const [x1, y1] = pt(a, r);
    const [x2, y2] = pt(b, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const v = value ?? hi;
  const [nx, ny] = pt(v, 64);
  return (
    <svg viewBox="0 0 200 116" className="w-full max-w-[260px]" role="img" aria-label={`DSCR ${value?.toFixed(2) ?? "n/a"}`}>
      <path d={arc(lo, hi, 80)} stroke="#ece8df" strokeWidth="16" fill="none" strokeLinecap="round" />
      <path d={arc(lo, min - 0.1, 80)} stroke="#f3c9c4" strokeWidth="16" fill="none" />
      <path d={arc(min - 0.1, min, 80)} stroke="#f2dcb4" strokeWidth="16" fill="none" />
      <path d={arc(min, hi, 80)} stroke="#bfe3cf" strokeWidth="16" fill="none" />
      <line x1="100" y1="100" x2={nx} y2={ny} stroke={COLORS[verdict]} strokeWidth="4" strokeLinecap="round" style={{ transition: "all .4s ease" }} />
      <circle cx="100" cy="100" r="7" fill={COLORS[verdict]} />
      {(() => {
        const [tx, ty] = pt(min, 98);
        return <text x={tx} y={ty} fontSize="9" textAnchor="middle" fill="#6f6a60">{min.toFixed(2)}</text>;
      })()}
    </svg>
  );
}
