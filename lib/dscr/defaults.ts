import type { BrokerDefaults, FicoLtvCap } from "./types";

export const DEFAULT_FICO_LTV_CAPS: FicoLtvCap[] = [
  { range: "760+", maxLtv: 0.8 },
  { range: "720-759", maxLtv: 0.8 },
  { range: "680-719", maxLtv: 0.75 },
  { range: "660-679", maxLtv: 0.7 },
  { range: "620-659", maxLtv: 0.65 },
  { range: "<620", maxLtv: 0 },
];

export const SYSTEM_DEFAULTS: BrokerDefaults = {
  minDscr: 1.0,
  maxLtv: 0.8,
  defaultRate: 7.5,
  termYears: 30,
  taxRatePct: 1.2,
  insuranceRatePct: 0.5,
  borderlineBand: 0.1,
  ficoLtvCaps: DEFAULT_FICO_LTV_CAPS,
};

/** Assumptions used for the Money List cash-out estimate (conservative, documented in UI). */
export const CASH_OUT_ASSUMPTIONS = {
  /** LTV assumed at original closing when no value is known. */
  originalLtv: 0.75,
  /** Annual appreciation assumption. */
  appreciationPct: 3,
  /** Max cash-out LTV. */
  cashOutLtv: 0.75,
};
