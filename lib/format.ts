/** Display formatting only. Values come from lib/dscr (cents, milli-percent, ratio ×10,000). */

export function usd(cents: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0 });
}

/** Signed money: "+$412" / "−$85". */
export function usdSigned(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents < 0 ? "−" : "+") + usd(Math.abs(cents));
}

export function rate(milli: number | null | undefined): string {
  if (milli == null) return "—";
  return `${(milli / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** Ratio ×10,000 as a percentage: 7500 → "75%", 7245 → "72.45%". */
export function pct(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${(ratio / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** DSCR ratio ×10,000 → "1.22". */
export function dscr(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return (Math.floor(ratio / 100) / 100).toFixed(2);
}

/** Points ratio (1 point = 100) → "1.25 points" / "0.5-point credit". */
export function points(ratio: number): string {
  if (!ratio) return "None";
  const p = Math.abs(ratio) / 100;
  return ratio > 0 ? `${p} point${p === 1 ? "" : "s"}` : `${p}-point lender credit`;
}

export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(d: Date | string): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 0) {
    const f = -s;
    if (f < 86400) return "today";
    if (f < 86400 * 30) return `in ${Math.round(f / 86400)}d`;
    return shortDate(d);
  }
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return shortDate(d);
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

/** Parse "$425,000" / "425k" → cents. Input parsing, not financial math. */
export function parseDollarsToCents(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase().replace(/[$,\s]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]!) * (m[2] === "k" ? 1000 : m[2] === "m" ? 1_000_000 : 1);
  return Math.round(n * 100);
}

/** "7.125" → 7125 milli-percent. */
export function parseRateToMilli(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[%\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round((n > 0 && n < 1 ? n * 100 : n) * 1000);
}

/** "25" (percent) → 2500 ratio. */
export function parsePctToRatio(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[%\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Elapsed-time helpers for UI decisions (not money). */
export const hoursSince = (d: Date | string) => (Date.now() - new Date(d).getTime()) / 3_600_000;
export const daysSince = (d: Date | string) => hoursSince(d) / 24;
