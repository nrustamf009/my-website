/**
 * Units used across the engine (and the database):
 *  - Cents:  integer US cents. $1,234.56 → 123456.
 *  - Milli:  integer milli-percent for rates. 7.125% → 7125.
 *  - Ratio:  integer ten-thousandths for LTV, DSCR, percentages of value. 80% → 8000, DSCR 1.20 → 12000.
 *
 * Rounding rules (see README in this folder):
 *  - Rate math (amortization) runs in float64 and is rounded HALF-UP to whole cents exactly once per output.
 *  - Sums and differences of money are done on integer cents and are exact.
 *  - Ratios are conservative: DSCR is rounded DOWN and LTV is rounded UP to the nearest ten-thousandth,
 *    so the engine never overstates coverage or understates leverage.
 */

export type Cents = number;
export type Milli = number;
export type Ratio = number;

export const RATIO_ONE = 10_000;

/** Half-up rounding that is symmetric for negatives and robust to float noise (e.g. 1.005). */
export function roundHalfUp(x: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`Cannot round non-finite value ${x}`);
  const sign = x < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}

export function assertCents(name: string, v: number): void {
  if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} must be a non-negative integer number of cents (got ${v})`);
}

export function assertRatio(name: string, v: number, max = RATIO_ONE): void {
  if (!Number.isInteger(v) || v < 0 || v > max) throw new RangeError(`${name} must be an integer ratio between 0 and ${max} (got ${v})`);
}

export function assertMilli(name: string, v: number): void {
  if (!Number.isInteger(v) || v < 0 || v > 30_000) throw new RangeError(`${name} must be an integer milli-percent between 0 and 30000 (got ${v})`);
}

/** cents × ratio, rounded half-up to cents. */
export function applyRatio(cents: Cents, ratio: Ratio): Cents {
  return roundHalfUp((cents * ratio) / RATIO_ONE);
}

/** a ÷ b as a Ratio (half-up). Returns null when b is 0. */
export function ratioOf(a: number, b: number): Ratio | null {
  if (b === 0) return null;
  return roundHalfUp((a * RATIO_ONE) / b);
}

/** DSCR-style ratio rounded DOWN (never overstated). null when b is 0. */
export function ratioFloor(a: number, b: number): Ratio | null {
  if (b === 0) return null;
  return Math.floor((a * RATIO_ONE) / b + 1e-9);
}

/** LTV-style ratio rounded UP (never understated). null when b is 0. */
export function ratioCeil(a: number, b: number): Ratio | null {
  if (b === 0) return null;
  return Math.ceil((a * RATIO_ONE) / b - 1e-9);
}

/** Annual cents → monthly cents (half-up). */
export function monthly(annualCents: Cents): Cents {
  return roundHalfUp(annualCents / 12);
}

export const dollars = (d: number): Cents => roundHalfUp(d * 100);
export const pctRatio = (pct: number): Ratio => roundHalfUp(pct * 100);
export const pctMilli = (pct: number): Milli => roundHalfUp(pct * 1000);

/** Monthly → annual (exact; used when notes state monthly taxes or insurance). */
export function annual(monthlyCents: Cents): Cents {
  return monthlyCents * 12;
}
