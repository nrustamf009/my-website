import type { DscrBucket, FicoBucket, Mode, Prepay, Product, ProgramGrid, PropertyType, PropertyUse, StateDefault, UsState, Verdict } from "./types";
import { productPayments } from "./amortization";
import { dscrBucketOf, dscrBucketRank, ficoEligible, gridRate, maxLtvFor, minEligibleDscr } from "./grid";
import { applyRatio, assertCents, monthly, ratioCeil, ratioFloor, ratioOf, roundHalfUp, type Cents, type Milli, type Ratio } from "./units";

export interface EngineContext {
  grid: ProgramGrid;
  stateDefaults: Record<UsState, StateDefault>;
}

export interface DealInput {
  mode: Mode;
  state: UsState;
  fico: FicoBucket;
  propertyType?: PropertyType;
  units?: number;
  use?: PropertyUse;
  /** Gross monthly market rent, all units. Lenders don't apply vacancy factors, so neither do we. */
  rentCents: Cents;
  /** Refi only: in-place lease. The lesser of lease and market rent is used. */
  leaseRentCents?: Cents | null;
  taxesAnnualCents?: Cents | null;
  insuranceAnnualCents?: Cents | null;
  hoaMonthlyCents?: Cents;
  product?: Product;
  prepay?: Prepay;
  /** Discount points as a ratio of the loan (1 point = 100). Lowers the rate via the grid's buydown assumption. */
  pointsRatio?: Ratio;
  /** Use this rate instead of the grid (scenario options, Money List). */
  rateMilliOverride?: Milli | null;
  // Purchase
  priceCents?: Cents;
  downPaymentRatio?: Ratio;
  downPaymentCents?: Cents;
  closingCostsCents?: Cents | null;
  // Refinance
  valueCents?: Cents;
  currentBalanceCents?: Cents;
  cashOutCents?: Cents;
  /** Rate-term only: explicit new loan amount (defaults to balance + financed closing costs). */
  loanAmountCents?: Cents | null;
  monthsOwned?: number | null;
  purchasePriceCents?: Cents | null;
}

export type ReasonCode =
  | "FICO_BELOW_FLOOR"
  | "LOAN_BELOW_MIN"
  | "LOAN_ABOVE_MAX"
  | "LTV_ABOVE_CAP"
  | "DSCR_BELOW_MIN"
  | "DSCR_NOT_ELIGIBLE"
  | "CASH_OUT_NOT_SEASONED"
  | "CASH_OUT_PURCHASE_PRICE_CAP"
  | "RENT_LEASE_LOWER"
  | "STR_NOTE";

export type Lever = "DOWN_PAYMENT" | "PRICE" | "RENT" | "BUYDOWN" | "CASH_OUT" | "PAYDOWN";

export interface WhatToChange {
  lever: Lever;
  /** Current and required value of the lever (cents, or points ratio for BUYDOWN). */
  from: number;
  to: number;
  /** Extra cash the investor must bring for this path. */
  cashCostCents: Cents;
  /** True when the change is large enough to be unrealistic (price −7%+, rent +10%+). */
  stretch: boolean;
  reaches: Verdict;
}

export interface DealAnalysis {
  mode: Mode;
  valueCents: Cents;
  /** Value used for LTV after seasoning rules (cash-out). */
  ltvValueCents: Cents;
  loanAmountCents: Cents;
  downPaymentCents: Cents;
  ltvRatio: Ratio;
  product: Product;
  prepay: Prepay;
  rateMilli: Milli;
  dscrBucket: DscrBucket;
  rateIterations: number;
  qualifyingRentCents: Cents;
  piCents: Cents;
  postIoPiCents: Cents | null;
  taxesMonthlyCents: Cents;
  insuranceMonthlyCents: Cents;
  hoaMonthlyCents: Cents;
  pitiaCents: Cents;
  postIoPitiaCents: Cents | null;
  dscrRatio: Ratio | null;
  cashFlowCents: Cents;
  maxLtvRatio: Ratio | null;
  maxLoanCents: Cents;
  closingCostsCents: Cents;
  prepaidsCents: Cents;
  pointsCostCents: Cents;
  cashToCloseCents: Cents;
  reservesCents: Cents;
  totalCashNeededCents: Cents;
  cashToBorrowerCents: Cents;
  verdict: Verdict;
  reasons: ReasonCode[];
  whatToChange: WhatToChange[];
  taxSource: "INPUT" | "STATE_DEFAULT";
  insuranceSource: "INPUT" | "STATE_DEFAULT";
}

interface Core {
  rateMilli: Milli;
  bucket: DscrBucket;
  iterations: number;
  pi: Cents;
  postIoPi: Cents | null;
  pitia: Cents;
  postIoPitia: Cents | null;
  dscr: Ratio | null;
  maxLtv: Ratio | null;
}

interface Normalized {
  mode: Mode;
  valueCents: Cents;
  ltvValueCents: Cents;
  loanCents: Cents;
  downCents: Cents;
  rentCents: Cents;
  taxesM: Cents;
  insM: Cents;
  hoaM: Cents;
  fico: FicoBucket;
  product: Product;
  prepay: Prepay;
  pointsRatio: Ratio;
  rateOverride: Milli | null;
  closingCents: Cents;
  cashToBorrowerCents: Cents;
  seasoningBlocked: boolean;
  purchaseCapApplied: boolean;
  leaseLower: boolean;
  taxSource: "INPUT" | "STATE_DEFAULT";
  insuranceSource: "INPUT" | "STATE_DEFAULT";
}

/**
 * Rate ↔ DSCR fixed point. The grid prices by DSCR bucket, but DSCR depends on the rate.
 * Start at the best bucket, re-price until the bucket is stable (≤3 passes). On oscillation
 * keep the more conservative (worse) bucket.
 */
function core(grid: ProgramGrid, n: Normalized): Core {
  const escrow = n.taxesM + n.insM + n.hoaM;
  const evalAt = (bucket: DscrBucket) => {
    const rateMilli = n.rateOverride ?? gridRate(grid, { mode: n.mode, fico: n.fico, bucket, product: n.product, prepay: n.prepay, pointsRatio: n.pointsRatio });
    const pay = productPayments(n.product, n.loanCents, rateMilli);
    const pitia = pay.initialPI + escrow;
    return { rateMilli, pay, pitia, dscr: ratioFloor(n.rentCents, pitia) };
  };
  let bucket: DscrBucket = ">=1.20";
  let r = evalAt(bucket);
  let iterations = 1;
  const seen = new Set<DscrBucket>([bucket]);
  while (iterations < 3) {
    const next = dscrBucketOf(r.dscr);
    if (next === bucket) break;
    if (seen.has(next)) {
      bucket = dscrBucketRank(next) > dscrBucketRank(bucket) ? next : bucket;
      r = evalAt(bucket);
      iterations++;
      break;
    }
    seen.add(next);
    bucket = next;
    r = evalAt(bucket);
    iterations++;
  }
  // Final bucket reflects the DSCR actually achieved at the chosen price.
  const finalBucket = n.rateOverride !== null ? dscrBucketOf(r.dscr) : dscrBucketRank(dscrBucketOf(r.dscr)) > dscrBucketRank(bucket) ? dscrBucketOf(r.dscr) : bucket;
  return {
    rateMilli: r.rateMilli,
    bucket: finalBucket,
    iterations,
    pi: r.pay.initialPI,
    postIoPi: r.pay.postIoPI,
    pitia: r.pitia,
    postIoPitia: r.pay.postIoPI === null ? null : r.pay.postIoPI + escrow,
    dscr: r.dscr,
    maxLtv: maxLtvFor(grid, n.mode, n.fico, finalBucket),
  };
}

function normalize(input: DealInput, ctx: EngineContext): Normalized {
  const { grid } = ctx;
  const st = ctx.stateDefaults[input.state];
  if (!st) throw new RangeError(`Unknown state ${input.state}`);
  assertCents("rentCents", input.rentCents);
  const isPurchase = input.mode === "PURCHASE";
  const valueCents = isPurchase ? input.priceCents ?? 0 : input.valueCents ?? 0;
  if (valueCents <= 0) throw new RangeError(isPurchase ? "priceCents is required" : "valueCents is required");

  const taxSource = input.taxesAnnualCents != null ? "INPUT" : "STATE_DEFAULT";
  const insuranceSource = input.insuranceAnnualCents != null ? "INPUT" : "STATE_DEFAULT";
  const taxesAnnual = input.taxesAnnualCents ?? applyRatio(valueCents, st.taxRatio);
  const insAnnual = input.insuranceAnnualCents ?? applyRatio(valueCents, st.insuranceRatio);

  let rentCents = input.rentCents;
  let leaseLower = false;
  if (!isPurchase && input.leaseRentCents != null && input.leaseRentCents < input.rentCents) {
    rentCents = input.leaseRentCents;
    leaseLower = true;
  }

  let loanCents: Cents;
  let downCents = 0;
  let closingCents: Cents;
  let cashToBorrowerCents = 0;
  let ltvValueCents = valueCents;
  let seasoningBlocked = false;
  let purchaseCapApplied = false;

  if (isPurchase) {
    downCents = input.downPaymentCents ?? applyRatio(valueCents, input.downPaymentRatio ?? 2500);
    downCents = Math.min(Math.max(0, downCents), valueCents);
    loanCents = valueCents - downCents;
    closingCents = input.closingCostsCents ?? applyRatio(valueCents, grid.closingCostRatio.purchase);
  } else {
    const balance = input.currentBalanceCents ?? 0;
    const cashOut = input.mode === "CASH_OUT" ? input.cashOutCents ?? 0 : 0;
    closingCents = input.closingCostsCents ?? applyRatio(balance + cashOut, grid.closingCostRatio.refi);
    // Closing costs are financed on refinances.
    loanCents = input.mode === "RATE_TERM" && input.loanAmountCents != null ? input.loanAmountCents : balance + cashOut + closingCents;
    cashToBorrowerCents = cashOut;
    if (input.mode === "CASH_OUT") {
      const months = input.monthsOwned ?? 999;
      if (months < grid.cashOutSeasoningMonths.purchasePriceCap) seasoningBlocked = true;
      else if (months < grid.cashOutSeasoningMonths.appraisedValue && input.purchasePriceCents != null && input.purchasePriceCents < valueCents) {
        ltvValueCents = input.purchasePriceCents;
        purchaseCapApplied = true;
      }
    }
  }

  return {
    mode: input.mode,
    valueCents,
    ltvValueCents,
    loanCents: Math.max(0, loanCents),
    downCents,
    rentCents,
    taxesM: monthly(taxesAnnual),
    insM: monthly(insAnnual),
    hoaM: input.hoaMonthlyCents ?? 0,
    fico: input.fico,
    product: input.product ?? "FIXED30",
    prepay: input.prepay ?? "5-4-3-2-1",
    pointsRatio: Math.max(0, input.pointsRatio ?? 0),
    rateOverride: input.rateMilliOverride ?? null,
    closingCents,
    cashToBorrowerCents,
    seasoningBlocked,
    purchaseCapApplied,
    leaseLower,
    taxSource,
    insuranceSource,
  };
}

const TIER_RANK: Record<Verdict, number> = { STRONG: 3, BORDERLINE: 2, NEEDS_ADJUSTMENT: 1, NOT_ELIGIBLE: 0 };

/** Verdict without the solver: STRONG / BORDERLINE / FAIL plus reasons. */
function baseVerdict(grid: ProgramGrid, n: Normalized, c: Core): { tier: "STRONG" | "BORDERLINE" | "FAIL"; hard: boolean; reasons: ReasonCode[] } {
  const reasons: ReasonCode[] = [];
  let hard = false;
  if (!ficoEligible(grid, n.fico)) {
    reasons.push("FICO_BELOW_FLOOR");
    hard = true;
  }
  if (n.seasoningBlocked) {
    reasons.push("CASH_OUT_NOT_SEASONED");
    hard = true;
  }
  if (n.loanCents < grid.minLoanCents) reasons.push("LOAN_BELOW_MIN");
  if (n.loanCents > grid.maxLoanCents) reasons.push("LOAN_ABOVE_MAX");
  const ltv = ratioCeil(n.loanCents, n.ltvValueCents) ?? 0;
  const dscr = c.dscr ?? Number.POSITIVE_INFINITY;
  if (dscr < 7_500) reasons.push("DSCR_NOT_ELIGIBLE");
  else if (dscr < minEligibleDscr(grid)) reasons.push("DSCR_BELOW_MIN");
  if (c.maxLtv !== null && ltv > c.maxLtv) reasons.push("LTV_ABOVE_CAP");
  const fail = reasons.length > 0 || c.maxLtv === null;
  if (fail) return { tier: "FAIL", hard, reasons };
  return { tier: dscr >= grid.strongDscrRatio ? "STRONG" : "BORDERLINE", hard, reasons };
}

function tierOf(grid: ProgramGrid, input: DealInput, ctx: EngineContext): number {
  const n = normalize(input, ctx);
  const v = baseVerdict(grid, n, core(grid, n));
  return v.tier === "STRONG" ? 3 : v.tier === "BORDERLINE" ? 2 : 0;
}

/** Smallest step index in [lo, hi] where pred(step) holds, assuming monotonic pred. null if none. */
function searchMin(lo: number, hi: number, pred: (i: number) => boolean): number | null {
  if (!pred(hi)) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (pred(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/**
 * "What to change": for each lever independently, the smallest change that reaches the next tier.
 * Ranked by extra cash the investor must bring; unrealistic ("stretch") changes go last.
 */
export function whatToChange(input: DealInput, ctx: EngineContext, currentTier: number): WhatToChange[] {
  const target = currentTier >= 2 ? 3 : 2;
  if (currentTier >= 3) return [];
  const g = ctx.grid;
  const reaches: Verdict = target === 3 ? "STRONG" : "BORDERLINE";
  const ok = (variant: DealInput) => {
    try {
      return tierOf(g, variant, ctx) >= target;
    } catch {
      return false;
    }
  };
  const out: WhatToChange[] = [];
  const n = normalize(input, ctx);

  if (input.mode === "PURCHASE") {
    // Down payment in 0.5% steps up to 50%.
    const curDown = n.downCents;
    const curRatio = ratioOf(curDown, n.valueCents) ?? 0;
    const startStep = Math.ceil(curRatio / 50) + 1;
    const step = searchMin(startStep, 100, (s) => ok({ ...input, downPaymentCents: undefined, downPaymentRatio: s * 50 }));
    if (step !== null) {
      const to = applyRatio(n.valueCents, step * 50);
      out.push({ lever: "DOWN_PAYMENT", from: curDown, to, cashCostCents: to - curDown, stretch: false, reaches });
    }
    // Price down in $1,000 steps (down payment % unchanged), up to −40%.
    const downRatio = curRatio;
    const maxSteps = Math.floor((n.valueCents * 0.4) / 100_000);
    const pStep = searchMin(1, Math.max(1, maxSteps), (s) => ok({ ...input, priceCents: n.valueCents - s * 100_000, downPaymentCents: undefined, downPaymentRatio: downRatio }));
    if (pStep !== null) {
      const to = n.valueCents - pStep * 100_000;
      out.push({ lever: "PRICE", from: n.valueCents, to, cashCostCents: 0, stretch: (n.valueCents - to) * 100 > n.valueCents * 7, reaches });
    }
  }

  if (input.mode === "CASH_OUT" && (input.cashOutCents ?? 0) > 0) {
    const cur = input.cashOutCents!;
    const steps = Math.ceil(cur / 100_000);
    const s = searchMin(1, steps, (k) => ok({ ...input, cashOutCents: Math.max(0, cur - k * 100_000) }));
    if (s !== null) out.push({ lever: "CASH_OUT", from: cur, to: Math.max(0, cur - s * 100_000), cashCostCents: 0, stretch: false, reaches });
  }

  if (input.mode === "RATE_TERM") {
    const loan = n.loanCents;
    const steps = Math.floor((loan * 0.5) / 100_000);
    const s = searchMin(1, Math.max(1, steps), (k) => ok({ ...input, loanAmountCents: loan - k * 100_000 }));
    if (s !== null) out.push({ lever: "PAYDOWN", from: loan, to: loan - s * 100_000, cashCostCents: s * 100_000, stretch: false, reaches });
  }

  // Rent up in $25 steps, up to +100%.
  const rentBase = input.rentCents;
  const rSteps = Math.max(1, Math.ceil(rentBase / 2_500));
  const rStep = searchMin(1, rSteps, (k) => ok({ ...input, rentCents: rentBase + k * 2_500, leaseRentCents: input.leaseRentCents != null ? input.leaseRentCents + k * 2_500 : null }));
  if (rStep !== null) {
    const to = rentBase + rStep * 2_500;
    out.push({ lever: "RENT", from: rentBase, to, cashCostCents: 0, stretch: (to - rentBase) * 10 > rentBase, reaches });
  }

  // Rate buydown in 0.25-point steps, up to 4 points (only when the rate comes from the grid).
  if (input.rateMilliOverride == null) {
    const cur = input.pointsRatio ?? 0;
    const bStep = searchMin(1, 16, (k) => ok({ ...input, pointsRatio: cur + k * 25 }));
    if (bStep !== null) {
      const to = cur + bStep * 25;
      const variant = normalize({ ...input, pointsRatio: to }, ctx);
      out.push({ lever: "BUYDOWN", from: cur, to, cashCostCents: applyRatio(variant.loanCents, to) - applyRatio(n.loanCents, cur), stretch: false, reaches });
    }
  }

  return out.sort((a, b) => Number(a.stretch) - Number(b.stretch) || a.cashCostCents - b.cashCostCents);
}

/** Largest loan (in $100 steps) that keeps the deal eligible (≥ Borderline) at this value. */
export function maxLoanAmount(input: DealInput, ctx: EngineContext): Cents {
  const n = normalize(input, ctx);
  const g = ctx.grid;
  const cap = Math.min(n.ltvValueCents, g.maxLoanCents);
  const okLoan = (loan: Cents) => {
    const variant: Normalized = { ...n, loanCents: loan };
    const c = core(g, variant);
    if (c.maxLtv === null || (c.dscr ?? Infinity) < minEligibleDscr(g)) return false;
    return (ratioCeil(loan, n.ltvValueCents) ?? 0) <= c.maxLtv;
  };
  const steps = Math.floor(cap / 10_000);
  if (steps <= 0 || !okLoan(10_000)) return 0;
  let lo = 1;
  let hi = steps;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (okLoan(mid * 10_000)) lo = mid;
    else hi = mid - 1;
  }
  const best = lo * 10_000;
  return best < g.minLoanCents ? 0 : best;
}

export function analyzeDeal(input: DealInput, ctx: EngineContext, opts: { solve?: boolean } = {}): DealAnalysis {
  const g = ctx.grid;
  const n = normalize(input, ctx);
  const c = core(g, n);
  const base = baseVerdict(g, n, c);
  const reasons = [...base.reasons];
  if (n.purchaseCapApplied) reasons.push("CASH_OUT_PURCHASE_PRICE_CAP");
  if (n.leaseLower) reasons.push("RENT_LEASE_LOWER");
  if (input.use === "STR") reasons.push("STR_NOTE");

  const solve = opts.solve !== false;
  let changes: WhatToChange[] = [];
  let verdict: Verdict;
  const tier = base.tier === "STRONG" ? 3 : base.tier === "BORDERLINE" ? 2 : 0;
  if (base.tier === "STRONG") verdict = "STRONG";
  else if (base.tier === "BORDERLINE") {
    verdict = "BORDERLINE";
    if (solve) changes = whatToChange(input, ctx, tier);
  } else if (base.hard) verdict = "NOT_ELIGIBLE";
  else {
    changes = solve ? whatToChange(input, ctx, tier) : [];
    verdict = changes.length ? "NEEDS_ADJUSTMENT" : "NOT_ELIGIBLE";
  }

  const pointsCost = applyRatio(n.loanCents, n.pointsRatio);
  const prepaids = n.insM * g.prepaids.insuranceMonths + n.taxesM * g.prepaids.taxMonths;
  const isPurchase = n.mode === "PURCHASE";
  // Purchase: down + closing + prepaids + points. Refi: closing costs are financed; prepaids + points are due.
  const cashToClose = isPurchase ? n.downCents + n.closingCents + prepaids + pointsCost : prepaids + pointsCost;
  const reserves = c.pitia * g.reservesMonths;

  return {
    mode: n.mode,
    valueCents: n.valueCents,
    ltvValueCents: n.ltvValueCents,
    loanAmountCents: n.loanCents,
    downPaymentCents: n.downCents,
    ltvRatio: ratioCeil(n.loanCents, n.ltvValueCents) ?? 0,
    product: n.product,
    prepay: n.prepay,
    rateMilli: c.rateMilli,
    dscrBucket: c.bucket,
    rateIterations: c.iterations,
    qualifyingRentCents: n.rentCents,
    piCents: c.pi,
    postIoPiCents: c.postIoPi,
    taxesMonthlyCents: n.taxesM,
    insuranceMonthlyCents: n.insM,
    hoaMonthlyCents: n.hoaM,
    pitiaCents: c.pitia,
    postIoPitiaCents: c.postIoPitia,
    dscrRatio: c.dscr,
    cashFlowCents: n.rentCents - c.pitia,
    maxLtvRatio: c.maxLtv,
    maxLoanCents: solve ? maxLoanAmount(input, ctx) : 0,
    closingCostsCents: n.closingCents,
    prepaidsCents: prepaids,
    pointsCostCents: pointsCost,
    cashToCloseCents: cashToClose,
    reservesCents: reserves,
    totalCashNeededCents: cashToClose + reserves,
    cashToBorrowerCents: n.cashToBorrowerCents,
    verdict,
    reasons,
    whatToChange: changes,
    taxSource: n.taxSource,
    insuranceSource: n.insuranceSource,
  };
}

export function verdictRank(v: Verdict): number {
  return TIER_RANK[v];
}

/** Minimum gross rent (cents) for DSCR ≥ target, re-pricing the rate as the DSCR bucket changes. */
export function minRentForDscr(input: DealInput, ctx: EngineContext, targetRatio: Ratio): Cents {
  const at = (rent: Cents) => analyzeDeal({ ...input, rentCents: rent, leaseRentCents: null }, ctx, { solve: false }).dscrRatio ?? Infinity;
  let lo = 0;
  let hi = 100;
  while (at(hi) < targetRatio) hi *= 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (at(mid) >= targetRatio) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Minimum down payment ratio (0.5% steps) to reach Borderline or better. null if > 50% needed. */
export function minDownPaymentRatio(input: DealInput, ctx: EngineContext): Ratio | null {
  const s = searchMin(0, 100, (k) => tierOf(ctx.grid, { ...input, downPaymentCents: undefined, downPaymentRatio: k * 50 }, ctx) >= 2);
  return s === null ? null : s * 50;
}

/**
 * Highest price ($1,000 steps) at the given down payment ratio that stays ≥ Borderline.
 * Eligibility falls as price rises, except below the loan minimum, so the search starts
 * at the smallest price whose loan meets the minimum.
 */
export function maxPurchasePrice(input: DealInput, ctx: EngineContext): Cents {
  const ratio = input.downPaymentRatio ?? 2500;
  const ok = (k: number) => {
    try {
      return tierOf(ctx.grid, { ...input, priceCents: k * 100_000, downPaymentCents: undefined, downPaymentRatio: ratio }, ctx) >= 2;
    } catch {
      return false;
    }
  };
  const loanShare = 10_000 - ratio;
  if (loanShare <= 0) return 0;
  const floorK = Math.ceil((ctx.grid.minLoanCents * 10_000) / loanShare / 100_000);
  if (!ok(floorK)) return 0;
  let lo = floorK;
  let hi = floorK * 2;
  while (ok(hi) && hi < 1_000_000) {
    lo = hi;
    hi *= 2;
  }
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo * 100_000;
}

/** Maximum cash-out (in $1,000 steps) that keeps a cash-out refinance ≥ Borderline. */
export function maxCashOut(input: DealInput, ctx: EngineContext): Cents {
  if (input.mode !== "CASH_OUT") return 0;
  const ok = (cash: Cents) => {
    try {
      return tierOf(ctx.grid, { ...input, cashOutCents: cash }, ctx) >= 2;
    } catch {
      return false;
    }
  };
  if (!ok(0)) return 0;
  let lo = 0;
  let hi = Math.floor((input.valueCents ?? 0) / 100_000);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ok(mid * 100_000)) lo = mid;
    else hi = mid - 1;
  }
  return lo * 100_000;
}

export { roundHalfUp };
