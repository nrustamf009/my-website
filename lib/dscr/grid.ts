import type { DscrBucket, FicoBucket, Mode, Prepay, Product, ProgramGrid } from "./types";
import { DSCR_BUCKETS, FICO_BUCKETS } from "./types";
import { roundHalfUp, type Milli, type Ratio } from "./units";

export const FICO_BUCKET_MIN: Record<FicoBucket, number> = { "740+": 740, "700-739": 700, "680-699": 680, "660-679": 660, "<660": 0 };

/** Credit score → pricing bucket. */
export function ficoBucketOf(score: number): FicoBucket {
  if (score >= 740) return "740+";
  if (score >= 700) return "700-739";
  if (score >= 680) return "680-699";
  if (score >= 660) return "660-679";
  return "<660";
}

export function dscrBucketOf(dscr: Ratio | null): DscrBucket {
  if (dscr === null) return ">=1.20";
  if (dscr >= 12_000) return ">=1.20";
  if (dscr >= 10_000) return "1.00-1.19";
  if (dscr >= 7_500) return "0.75-0.99";
  return "<0.75";
}

/** Lower = better pricing/eligibility. */
export function dscrBucketRank(b: DscrBucket): number {
  return DSCR_BUCKETS.indexOf(b);
}

function ltvTable(cap80: Ratio | null, cap75: Ratio | null, cap70: Ratio | null): Record<FicoBucket, Record<DscrBucket, Ratio | null>> {
  const row = (base: Ratio | null): Record<DscrBucket, Ratio | null> => ({
    ">=1.20": base,
    "1.00-1.19": base,
    "0.75-0.99": base === null ? null : Math.min(base, 7000),
    "<0.75": null,
  });
  return { "740+": row(cap80), "700-739": row(cap80), "680-699": row(cap75), "660-679": row(cap70), "<660": row(null) };
}

/** Default program grid. Brokers edit their own copy in Settings. */
export const DEFAULT_GRID: ProgramGrid = {
  baseRateMilli: 7125,
  maxLtvRatio: {
    PURCHASE: ltvTable(8000, 7500, 7000),
    RATE_TERM: ltvTable(8000, 7500, 7000),
    CASH_OUT: ltvTable(7500, 7000, 6500),
  },
  rateAdjMilli: {
    fico: { "740+": 0, "700-739": 250, "680-699": 500, "660-679": 875, "<660": 0 },
    dscr: { ">=1.20": 0, "1.00-1.19": 250, "0.75-0.99": 750, "<0.75": 0 },
    product: { FIXED30: 0, IO30: 250, IO40: 375, ARM5_6: -375, ARM7_6: -250 },
    prepay: { "5-4-3-2-1": 0, "5-5-5-5-5": -125, "3-2-1": 375, "3-3-3": 250, "2-1": 625, "1": 875, NONE: 1250 },
    mode: { PURCHASE: 0, RATE_TERM: 0, CASH_OUT: 250 },
  },
  subOneDscrEnabled: false,
  minLoanCents: 100_000_00,
  maxLoanCents: 3_000_000_00,
  ficoFloor: 660,
  strongDscrRatio: 12_000,
  minDscrRatio: 10_000,
  reservesMonths: 6,
  closingCostRatio: { purchase: 300, refi: 350 },
  prepaids: { insuranceMonths: 12, taxMonths: 3 },
  buydownMilliPerPoint: 250,
  cashOutSeasoningMonths: { purchasePriceCap: 6, appraisedValue: 12 },
};

export function ficoEligible(grid: ProgramGrid, fico: FicoBucket): boolean {
  return FICO_BUCKET_MIN[fico] >= grid.ficoFloor;
}

/** Max LTV for a cell, honoring the sub-1.0 switch and FICO floor. null = not eligible. */
export function maxLtvFor(grid: ProgramGrid, mode: Mode, fico: FicoBucket, bucket: DscrBucket): Ratio | null {
  if (!ficoEligible(grid, fico)) return null;
  if (bucket === "<0.75") return null;
  if (bucket === "0.75-0.99" && !grid.subOneDscrEnabled) return null;
  return grid.maxLtvRatio[mode][fico][bucket];
}

export function gridRate(grid: ProgramGrid, p: { mode: Mode; fico: FicoBucket; bucket: DscrBucket; product: Product; prepay: Prepay; pointsRatio: Ratio }): Milli {
  const a = grid.rateAdjMilli;
  const buydown = roundHalfUp((Math.max(0, p.pointsRatio) * grid.buydownMilliPerPoint) / 100);
  // A worse DSCR bucket is never priced cheaper than a better one (keeps DSCR monotonic in rent/down).
  const order = [">=1.20", "1.00-1.19", "0.75-0.99", "<0.75"] as const;
  const dscrAdj = Math.max(...order.slice(0, order.indexOf(p.bucket) + 1).map((b) => a.dscr[b]));
  return Math.max(0, grid.baseRateMilli + a.fico[p.fico] + dscrAdj + a.product[p.product] + a.prepay[p.prepay] + a.mode[p.mode] - buydown);
}

export function minEligibleDscr(grid: ProgramGrid): Ratio {
  return grid.subOneDscrEnabled ? 7_500 : grid.minDscrRatio;
}

export function isFicoBucket(s: string | null | undefined): s is FicoBucket {
  return !!s && (FICO_BUCKETS as string[]).includes(s);
}

/** Deep-merge a broker's saved grid onto the defaults so new fields always exist. */
export function normalizeGrid(saved: unknown): ProgramGrid {
  if (!saved || typeof saved !== "object") return DEFAULT_GRID;
  const s = saved as Partial<ProgramGrid>;
  return {
    ...DEFAULT_GRID,
    ...s,
    maxLtvRatio: { ...DEFAULT_GRID.maxLtvRatio, ...(s.maxLtvRatio ?? {}) },
    rateAdjMilli: {
      fico: { ...DEFAULT_GRID.rateAdjMilli.fico, ...(s.rateAdjMilli?.fico ?? {}) },
      dscr: { ...DEFAULT_GRID.rateAdjMilli.dscr, ...(s.rateAdjMilli?.dscr ?? {}) },
      product: { ...DEFAULT_GRID.rateAdjMilli.product, ...(s.rateAdjMilli?.product ?? {}) },
      prepay: { ...DEFAULT_GRID.rateAdjMilli.prepay, ...(s.rateAdjMilli?.prepay ?? {}) },
      mode: { ...DEFAULT_GRID.rateAdjMilli.mode, ...(s.rateAdjMilli?.mode ?? {}) },
    },
    closingCostRatio: { ...DEFAULT_GRID.closingCostRatio, ...(s.closingCostRatio ?? {}) },
    prepaids: { ...DEFAULT_GRID.prepaids, ...(s.prepaids ?? {}) },
    cashOutSeasoningMonths: { ...DEFAULT_GRID.cashOutSeasoningMonths, ...(s.cashOutSeasoningMonths ?? {}) },
  };
}
