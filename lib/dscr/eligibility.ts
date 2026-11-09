import type { BrokerDefaults, FicoRange, Verdict } from "./types";

/** Effective max LTV = min(broker max LTV, FICO cap). 0 means not eligible. */
export function effectiveMaxLtv(defaults: Pick<BrokerDefaults, "maxLtv" | "ficoLtvCaps">, fico?: FicoRange | null): number {
  if (!fico) return defaults.maxLtv;
  const cap = defaults.ficoLtvCaps.find((c) => c.range === fico);
  return cap ? Math.min(defaults.maxLtv, cap.maxLtv) : defaults.maxLtv;
}

/**
 * Verdict rules:
 *  - UNLIKELY if not eligible by FICO, or DSCR is unknown/below (minDscr - band).
 *  - LIKELY if DSCR >= minDscr and LTV <= max LTV.
 *  - BORDERLINE otherwise (DSCR slightly short, or only LTV blocks).
 */
export function getVerdict(params: {
  dscr: number | null;
  minDscr: number;
  borderlineBand: number;
  ltv: number;
  maxLtv: number;
}): Verdict {
  const { dscr, minDscr, borderlineBand, ltv, maxLtv } = params;
  const eps = 1e-9;
  if (maxLtv <= 0) return "UNLIKELY";
  if (dscr === null) return ltv <= eps ? "LIKELY" : "UNLIKELY";
  const dscrOk = dscr + eps >= minDscr;
  const ltvOk = ltv <= maxLtv + eps;
  if (dscrOk && ltvOk) return "LIKELY";
  if (dscr + eps >= minDscr - borderlineBand) return "BORDERLINE";
  return "UNLIKELY";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  LIKELY: "Likely qualifies",
  BORDERLINE: "Borderline",
  UNLIKELY: "Unlikely to qualify",
};
