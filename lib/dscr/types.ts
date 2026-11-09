/**
 * Shared types for the DSCR math core.
 * Conventions:
 *  - Dollar amounts are plain numbers in dollars.
 *  - Rates are annual percentages (7.25 means 7.25%).
 *  - Ratios (LTV, down payment) are decimals (0.8 means 80%).
 */

export type PrepayType = "5-4-3-2-1" | "3-2-1" | "NONE";
export const PREPAY_TYPES: PrepayType[] = ["5-4-3-2-1", "3-2-1", "NONE"];

export type FicoRange = "760+" | "720-759" | "680-719" | "660-679" | "620-659" | "<620";
export const FICO_RANGES: FicoRange[] = ["760+", "720-759", "680-719", "660-679", "620-659", "<620"];

export type Verdict = "LIKELY" | "BORDERLINE" | "UNLIKELY";

export interface FicoLtvCap {
  range: FicoRange;
  /** Max LTV for this FICO range. 0 means not eligible. */
  maxLtv: number;
}

/** Per-broker underwriting defaults. Stored on the Broker row. */
export interface BrokerDefaults {
  minDscr: number;
  maxLtv: number;
  defaultRate: number;
  termYears: number;
  /** Annual property tax as % of price. */
  taxRatePct: number;
  /** Annual hazard insurance as % of price. */
  insuranceRatePct: number;
  /** DSCR band below minDscr that is still "Borderline". */
  borderlineBand: number;
  ficoLtvCaps: FicoLtvCap[];
}

export interface Escrow {
  taxesMonthly: number;
  insuranceMonthly: number;
  hoaMonthly: number;
}
