import type { Verdict } from "@/lib/dscr";
import { gaugeGeometry } from "@/lib/charts/gauge";
import { dscr } from "@/lib/format";

const COLORS: Record<Verdict, string> = { STRONG: "#157a4a", BORDERLINE: "#a15c07", NEEDS_ADJUSTMENT: "#b45309", NOT_ELIGIBLE: "#b42318" };

export function DscrGauge({ value, verdict, minRatio, strongRatio }: { value: number | null; verdict: Verdict; minRatio: number; strongRatio: number }) {
  const g = gaugeGeometry(value, minRatio, strongRatio);
  return (
    <svg viewBox="0 0 200 116" className="w-full max-w-[240px]" role="img" aria-label={`DSCR ${dscr(value)}`}>
      <path d={g.track} stroke="#ece8df" strokeWidth="16" fill="none" strokeLinecap="round" />
      <path d={g.bad} stroke="#f3c9c4" strokeWidth="16" fill="none" />
      <path d={g.mid} stroke="#f2dcb4" strokeWidth="16" fill="none" />
      <path d={g.good} stroke="#bfe3cf" strokeWidth="16" fill="none" />
      <line x1="100" y1="100" x2={g.needle.x} y2={g.needle.y} stroke={COLORS[verdict]} strokeWidth="4" strokeLinecap="round" style={{ transition: "all .4s ease" }} />
      <circle cx="100" cy="100" r="7" fill={COLORS[verdict]} />
      <text x={g.minLabel.x} y={g.minLabel.y} fontSize="9" textAnchor="middle" fill="#6f6a60">{dscr(minRatio)}</text>
    </svg>
  );
}
