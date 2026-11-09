import type { PrepayType } from "./types";

/** Penalty % by loan year for each supported prepay structure. */
export function prepaySchedule(type: PrepayType): number[] {
  switch (type) {
    case "5-4-3-2-1":
      return [5, 4, 3, 2, 1];
    case "3-2-1":
      return [3, 2, 1];
    default:
      return [];
  }
}

export const PREPAY_LABEL: Record<PrepayType, string> = {
  "5-4-3-2-1": "5-4-3-2-1 (5 years)",
  "3-2-1": "3-2-1 (3 years)",
  NONE: "No prepay penalty",
};

/** Whole months between two dates (a <= b gives >= 0). */
export function monthsBetween(a: Date, b: Date): number {
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return r;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Date the prepay penalty ends. Null when there is no penalty. */
export function prepayExpiry(closingDate: Date, termYears: number): Date | null {
  if (termYears <= 0) return null;
  return addMonths(closingDate, termYears * 12);
}

/**
 * Penalty % if the loan is paid off on `asOf`.
 * For a known step-down schedule the % follows the loan year; for "OTHER" types
 * with only a term, a flat 1% applies until expiry (conservative placeholder).
 */
export function prepayPenaltyPct(type: PrepayType | "OTHER", closingDate: Date, termYears: number, asOf: Date): number {
  if (termYears <= 0 || type === "NONE") return 0;
  const months = monthsBetween(closingDate, asOf);
  if (months < 0) return type === "OTHER" ? 1 : prepaySchedule(type)[0] ?? 0;
  if (months >= termYears * 12) return 0;
  if (type === "OTHER") return 1;
  const schedule = prepaySchedule(type);
  return schedule[Math.floor(months / 12)] ?? 0;
}
