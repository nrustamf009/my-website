/**
 * GOLDEN FILE: hand-verified lib/dscr scenarios.
 * Units: cents (integer), milli-percent rates (7.125% = 7125), ratios ×10,000 (1.20 = 12000, 75% = 7500).
 * Rounding: rate math in float64, rounded half-up to cents once per output; sums on integer cents.
 * Ratios are conservative: DSCR rounded down, LTV rounded up (4 decimals).
 * Amortizing P&I: P = L·r / (1 − (1 + r)^−n), r = annual% / 12.
 * Default grid: base 7.125%; FICO 740+ +0; DSCR ≥1.20 +0, 1.00–1.19 +0.25%, 0.75–0.99 +0.75%;
 * cash-out +0.25%; IO30 +0.25%; LTV caps purchase 80/80/75/70, cash-out 75/75/70/65; sub-1.0 off.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT,
  DEFAULT_GRID,
  DEFAULT_MONEY_LIST_RULES,
  amortizingPayment,
  analyzeDeal,
  balanceAfter,
  computeScenarioOption,
  dscrBucketOf,
  evaluateClosedLoan,
  interestOnlyPayment,
  maxLoanAmount,
  minRentForDscr,
  prepayPenaltyCents,
  prepayPenaltyRatio,
  prepaySchedule,
  productPayments,
  roundHalfUp,
  listingSnapshot,
  type DealInput,
  type ListingColumn,
} from "..";

const ctx = DEFAULT_CONTEXT;
// $400,000 purchase, 25% down, FICO 740+, TX, taxes $4,800/yr ($400/mo), insurance $2,400/yr ($200/mo).
const purchase = (o: Partial<DealInput> = {}): DealInput => ({
  mode: "PURCHASE",
  state: "TX",
  fico: "740+",
  priceCents: 400_000_00,
  downPaymentRatio: 2_500,
  rentCents: 3_200_00,
  taxesAnnualCents: 4_800_00,
  insuranceAnnualCents: 2_400_00,
  ...o,
});

describe("G1–G4 payments by product", () => {
  it("G1 FIXED30: $300,000 at 7.000%: r = 0.0058333; P = 1,995.9075 → $1,995.91", () => {
    expect(amortizingPayment(300_000_00, 7_000, 360)).toBe(1_995_91);
  });
  it("G2 IO30: interest-only 300,000 × 0.07 / 12 = $1,750.00; after 10 yrs amortize over 240 mo → $2,325.90", () => {
    const p = productPayments("IO30", 300_000_00, 7_000);
    expect(p.initialPI).toBe(1_750_00);
    expect(p.postIoPI).toBe(2_325_90);
  });
  it("G3 IO40: IO $1,750.00; after 10 yrs amortize over the remaining 360 mo → $1,995.91", () => {
    const p = productPayments("IO40", 300_000_00, 7_000);
    expect(p.initialPI).toBe(1_750_00);
    expect(p.postIoPI).toBe(1_995_91);
  });
  it("G4 ARM 5/6 and 7/6: initial fixed-period payment equals a 30-yr amortizing payment", () => {
    expect(productPayments("ARM5_6", 300_000_00, 7_000).initialPI).toBe(1_995_91);
    expect(productPayments("ARM7_6", 300_000_00, 7_000).spec.fixedMonths).toBe(84);
    expect(interestOnlyPayment(300_000_00, 0)).toBe(0);
  });
});

describe("G5–G9 purchase analysis and verdicts", () => {
  it("G5 strong deal: loan 300,000 at 7.125% → P&I 2,021.16; PITIA 2,021.16 + 400 + 200 = 2,621.16; DSCR 3,200 / 2,621.16 = 1.2208 → Looks strong", () => {
    const a = analyzeDeal(purchase(), ctx);
    expect(a.loanAmountCents).toBe(300_000_00);
    expect(a.rateMilli).toBe(7_125);
    expect(a.piCents).toBe(2_021_16);
    expect(a.pitiaCents).toBe(2_621_16);
    expect(a.dscrRatio).toBe(12_208);
    expect(a.verdict).toBe("STRONG");
    // Cash to close: down 100,000 + closing 3% × 400,000 = 12,000 + prepaids (12 × 200 + 3 × 400 = 3,600) = $115,600.
    expect(a.cashToCloseCents).toBe(115_600_00);
    // Reserves: 6 × 2,621.16 = $15,726.96.
    expect(a.reservesCents).toBe(15_726_96);
    expect(a.cashFlowCents).toBe(578_84);
  });

  it("G6 rate ↔ DSCR fixed point: rent 2,900 → 1.1064 at base rate falls to bucket 1.00–1.19 → re-priced at 7.375%: P&I 2,072.03, PITIA 2,672.03, DSCR 1.0853 → Borderline", () => {
    const a = analyzeDeal(purchase({ rentCents: 2_900_00 }), ctx);
    expect(a.rateMilli).toBe(7_375);
    expect(a.pitiaCents).toBe(2_672_03);
    expect(a.dscrRatio).toBe(10_853);
    expect(a.dscrBucket).toBe("1.00-1.19");
    expect(a.rateIterations).toBe(2);
    expect(a.verdict).toBe("BORDERLINE");
  });

  it("G7 DSCR < 1.0: rent 2,500 → re-priced at 7.875% (sub-1.0 bucket +0.75%): PITIA 2,775.21, DSCR 0.9008 → Needs adjustment; rent lever: $2,675 (2,675 / 2,672.03 = 1.0011 at 7.375%)", () => {
    const a = analyzeDeal(purchase({ rentCents: 2_500_00 }), ctx);
    expect(a.rateMilli).toBe(7_875);
    expect(a.pitiaCents).toBe(2_775_21);
    expect(a.dscrRatio).toBe(9_008);
    expect(a.verdict).toBe("NEEDS_ADJUSTMENT");
    expect(a.reasons).toContain("DSCR_BELOW_MIN");
    const rent = a.whatToChange.find((w) => w.lever === "RENT")!;
    expect(rent.to).toBe(2_675_00);
    expect(rent.stretch).toBe(false);
    // Down payment lever must exist and its result must really reach Borderline.
    const down = a.whatToChange.find((w) => w.lever === "DOWN_PAYMENT")!;
    expect(analyzeDeal(purchase({ rentCents: 2_500_00, downPaymentCents: down.to }), ctx).verdict).not.toBe("NEEDS_ADJUSTMENT");
    // Cheapest path first: $0-cash, non-stretch levers before cash levers.
    expect(a.whatToChange[0]!.cashCostCents).toBe(0);
  });

  it("G8 FICO below floor (<660) → Not eligible, no levers offered", () => {
    const a = analyzeDeal(purchase({ fico: "<660" }), ctx);
    expect(a.verdict).toBe("NOT_ELIGIBLE");
    expect(a.reasons).toContain("FICO_BELOW_FLOOR");
    expect(a.whatToChange).toEqual([]);
  });

  it("G9 FICO 660–679 caps LTV at 70%: 25% down = 75% LTV → Needs adjustment; down payment lever → 30% ($120,000)", () => {
    const a = analyzeDeal(purchase({ fico: "660-679", rentCents: 3_600_00 }), ctx);
    expect(a.maxLtvRatio).toBe(7_000);
    expect(a.reasons).toContain("LTV_ABOVE_CAP");
    expect(a.verdict).toBe("NEEDS_ADJUSTMENT");
    expect(a.whatToChange.find((w) => w.lever === "DOWN_PAYMENT")!.to).toBe(120_000_00);
  });
});

describe("G10 state-default fallback", () => {
  it("FL $400,000, no taxes/insurance given → tax 0.91% = 3,640/yr → 303.33/mo; insurance 1.40% = 5,600/yr → 466.67/mo", () => {
    const a = analyzeDeal(purchase({ state: "FL", taxesAnnualCents: null, insuranceAnnualCents: null }), ctx);
    expect(a.taxesMonthlyCents).toBe(303_33);
    expect(a.insuranceMonthlyCents).toBe(466_67);
    expect(a.taxSource).toBe("STATE_DEFAULT");
  });
});

describe("G11–G14 refinance modes", () => {
  const cashOut = (o: Partial<DealInput> = {}): DealInput => ({
    mode: "CASH_OUT",
    state: "AZ",
    fico: "740+",
    valueCents: 500_000_00,
    currentBalanceCents: 250_000_00,
    cashOutCents: 100_000_00,
    monthsOwned: 24,
    rentCents: 4_000_00,
    taxesAnnualCents: 6_000_00,
    insuranceAnnualCents: 3_000_00,
    ...o,
  });

  it("G11 cash-out: closing 3.5% × (250,000 + 100,000) = 12,250 financed → loan 362,250; LTV 72.45% ≤ 75%; rate 7.125 + 0.25 = 7.375% → P&I 2,501.97; PITIA 3,251.97; DSCR 1.2300", () => {
    const a = analyzeDeal(cashOut(), ctx);
    expect(a.closingCostsCents).toBe(12_250_00);
    expect(a.loanAmountCents).toBe(362_250_00);
    expect(a.ltvRatio).toBe(7_245);
    expect(a.rateMilli).toBe(7_375);
    expect(a.piCents).toBe(2_501_97);
    expect(a.pitiaCents).toBe(3_251_97);
    expect(a.dscrRatio).toBe(12_300);
    expect(a.verdict).toBe("STRONG");
    // Refi cash to close = prepaids only: 12 × 250 + 3 × 500 = $4,500.
    expect(a.cashToCloseCents).toBe(4_500_00);
    expect(a.cashToBorrowerCents).toBe(100_000_00);
  });

  it("G12 cash-out seasoned 8 months: value basis capped at purchase price 400,000 → loan 289,800 / 400,000 = 72.45%", () => {
    const a = analyzeDeal(cashOut({ monthsOwned: 8, purchasePriceCents: 400_000_00, cashOutCents: 30_000_00 }), ctx);
    expect(a.ltvValueCents).toBe(400_000_00);
    expect(a.loanAmountCents).toBe(289_800_00);
    expect(a.ltvRatio).toBe(7_245);
    expect(a.reasons).toContain("CASH_OUT_PURCHASE_PRICE_CAP");
  });

  it("G13 cash-out seasoned 4 months (< 6) → Not eligible", () => {
    const a = analyzeDeal(cashOut({ monthsOwned: 4 }), ctx);
    expect(a.verdict).toBe("NOT_ELIGIBLE");
    expect(a.reasons).toContain("CASH_OUT_NOT_SEASONED");
  });

  it("G14 rate-term: lease $2,800 < market $3,000 → qualifying rent = lease; loan = 280,000 + 3.5% closing 9,800 = 289,800", () => {
    const a = analyzeDeal(
      { mode: "RATE_TERM", state: "GA", fico: "740+", valueCents: 400_000_00, currentBalanceCents: 280_000_00, rentCents: 3_000_00, leaseRentCents: 2_800_00, taxesAnnualCents: 4_800_00, insuranceAnnualCents: 2_400_00 },
      ctx,
    );
    expect(a.qualifyingRentCents).toBe(2_800_00);
    expect(a.reasons).toContain("RENT_LEASE_LOWER");
    expect(a.loanAmountCents).toBe(289_800_00);
  });
});

describe("G15 prepayment schedules", () => {
  it("penalty % by loan month for every structure", () => {
    expect(prepayPenaltyRatio("5-4-3-2-1", 14)).toBe(400); // year 2 → 4%
    expect(prepayPenaltyRatio("5-5-5-5-5", 50)).toBe(500); // year 5 → 5%
    expect(prepayPenaltyRatio("3-3-3", 36)).toBe(300);
    expect(prepayPenaltyRatio("3-3-3", 37)).toBe(0);
    expect(prepayPenaltyRatio("3-2-1", 25)).toBe(100);
    expect(prepayPenaltyRatio("2-1", 13)).toBe(100);
    expect(prepayPenaltyRatio("1", 12)).toBe(100);
    expect(prepayPenaltyRatio("1", 13)).toBe(0);
    expect(prepayPenaltyRatio("NONE", 1)).toBe(0);
  });
  it("$ penalty: 300,000 at 7% FIXED30 → balance after 12 payments 296,952.57; 4% in month 13 = $11,878.10", () => {
    const bal = balanceAfter("FIXED30", 300_000_00, 7_000, 12);
    expect(bal).toBe(296_952_57);
    expect(prepayPenaltyCents("5-4-3-2-1", bal, 13)).toBe(11_878_10);
    // Schedule row for year 5 uses the balance after 48 payments (286,423.64) × 1% = $2,864.24.
    const rows = prepaySchedule("5-4-3-2-1", "FIXED30", 300_000_00, 7_000);
    expect(rows).toHaveLength(5);
    expect(rows[4]).toEqual({ year: 5, penaltyRatio: 100, balanceCents: 286_423_64, penaltyCents: 2_864_24 });
  });
});

describe("G16–G17 grid edge boundaries", () => {
  it("G16 DSCR 1.2000 is in the ≥1.20 bucket; 1.1999 is not; 0.7500 is sub-1.0; 0.7499 is not eligible", () => {
    expect(dscrBucketOf(12_000)).toBe(">=1.20");
    expect(dscrBucketOf(11_999)).toBe("1.00-1.19");
    expect(dscrBucketOf(7_500)).toBe("0.75-0.99");
    expect(dscrBucketOf(7_499)).toBe("<0.75");
  });
  it("G17 sub-1.0 programs: with the switch on, DSCR 0.90 at 30% down (70% LTV cap) → Borderline; at 25% down → Needs adjustment", () => {
    const sub = { ...ctx, grid: { ...DEFAULT_GRID, subOneDscrEnabled: true } };
    expect(analyzeDeal(purchase({ rentCents: 2_500_00, downPaymentRatio: 3_000 }), sub).verdict).toBe("BORDERLINE");
    const a = analyzeDeal(purchase({ rentCents: 2_500_00 }), sub);
    expect(a.maxLtvRatio).toBe(7_000);
    expect(a.verdict).toBe("NEEDS_ADJUSTMENT");
  });
});

describe("G18 Money List math", () => {
  it("loan 400,000 at 8% closed 2023-12-28 (3-2-1, 36 mo); as of 2026-11-13: 34 months, balance 389,795.68; penalty 1% = 3,897.96; market 6.75%: 2,935.06 → 2,528.21 = $406.85/mo; costs 3.5% = 13,642.85; net 36 × 406.85 − 3,897.96 − 13,642.85 = −2,894.21; breakeven ⌈17,540.81 / 406.85⌉ = 44 mo", () => {
    const e = evaluateClosedLoan(
      { loanAmountCents: 400_000_00, rateMilli: 8_000, closingDate: new Date(Date.UTC(2023, 11, 28)), product: "FIXED", prepayType: "3-2-1", prepayTermMonths: 36 },
      { ...DEFAULT_MONEY_LIST_RULES, horizonMonths: 36, refiClosingCostRatio: 350 },
      6_750,
      new Date(Date.UTC(2026, 10, 13)),
    );
    expect(e.monthsSinceClosing).toBe(34);
    expect(e.balanceCents).toBe(389_795_68);
    expect(e.prepay.state).toBe("EXPIRING");
    expect(e.prepay.state === "EXPIRING" && e.prepay.penaltyTodayCents).toBe(3_897_96);
    expect(e.monthlySavingsCents).toBe(406_85);
    expect(e.refiCostsCents).toBe(13_642_85);
    expect(e.netRefiBenefitCents).toBe(-2_894_21);
    expect(e.breakevenMonth).toBe(44);
    expect(e.triggers.map((t) => t.kind).sort()).toEqual(["ANNIVERSARY", "PREPAY", "RATE"].filter((k) => e.triggers.some((t) => t.kind === k)).sort());
    expect(e.triggers.some((t) => t.kind === "PREPAY")).toBe(true);
    expect(e.triggers.some((t) => t.kind === "RATE")).toBe(true);
  });
});

describe("G19 scenario option", () => {
  it("IO30, $320,000 at 7.5%, 1 point, $1,495 fees, $400,000 purchase, taxes 6,000/yr, ins 2,400/yr: IO 2,000.00; PITIA 2,700.00; post-IO 2,577.90 + 700 = 3,277.90; 5-yr cost 60 × 2,700 + 3,200 + 1,495 = $166,695; cash to close 80,000 + 12,000 + 3,900 + 3,200 = $99,100", () => {
    const r = computeScenarioOption(
      { mode: "PURCHASE", valueCents: 400_000_00, rentCents: 3_000_00, taxesAnnualCents: 6_000_00, insuranceAnnualCents: 2_400_00, hoaMonthlyCents: 0 },
      { product: "IO30", loanAmountCents: 320_000_00, rateMilli: 7_500, pointsRatio: 100, feesCents: 1_495_00, prepay: "3-2-1" },
      DEFAULT_GRID,
    );
    expect(r.piCents).toBe(2_000_00);
    expect(r.pitiaCents).toBe(2_700_00);
    expect(r.postIoPitiaCents).toBe(3_277_90);
    expect(r.fiveYearCostCents).toBe(166_695_00);
    expect(r.cashToCloseCents).toBe(99_100_00);
    expect(r.prepaySchedule.map((x) => x.penaltyRatio)).toEqual([300, 200, 100]);
  });
});

describe("G19b cash-out scenario with a known payoff", () => {
  it("$500,000 value, $250,000 payoff, $375,000 loan: closing 3.5% = 13,125; prepaids 2,400 + 1,500; cash to borrower 375,000 − 250,000 − 13,125 − 3,900 = $107,975", () => {
    const r = computeScenarioOption(
      { mode: "CASH_OUT", valueCents: 500_000_00, rentCents: 3_400_00, taxesAnnualCents: 6_000_00, insuranceAnnualCents: 2_400_00, hoaMonthlyCents: 0, currentBalanceCents: 250_000_00 },
      { product: "FIXED30", loanAmountCents: 375_000_00, rateMilli: 7_250, pointsRatio: 0, feesCents: 0, prepay: "5-4-3-2-1" },
      DEFAULT_GRID,
    );
    expect(r.closingCostsCents).toBe(13_125_00);
    expect(r.cashToBorrowerCents).toBe(107_975_00);
    expect(r.cashToCloseCents).toBe(0);
    expect(r.ltvRatio).toBe(7_500);
  });
});

describe("G20 solvers", () => {
  it("min rent for DSCR 1.00 at the re-priced rate equals PITIA at 7.375% ($2,672.03)", () => {
    expect(minRentForDscr(purchase(), ctx, 10_000)).toBe(2_672_03);
  });
  it("max loan is LTV-limited at 80% (= $320,000) when rent is strong", () => {
    expect(maxLoanAmount(purchase({ rentCents: 4_500_00 }), ctx)).toBe(320_000_00);
  });
  it("rounding is half-up and symmetric", () => {
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(100.4999)).toBe(100);
    expect(roundHalfUp(1.005 * 100)).toBe(101); // float noise (100.49999…) still rounds half-up
  });
});

describe("Listing snapshot", () => {
  it("25% down beats 20% down on DSCR and payment; rent targets bracket the given rent", () => {
    const cols = listingSnapshot({ state: "TX", listPriceCents: 40_000_000, rentCents: 290_000, rateMilli: 7_250 }, DEFAULT_CONTEXT);
    expect(cols.map((c) => c.downRatio)).toEqual([2_000, 2_500]);
    const [a, b] = cols as [ListingColumn, ListingColumn];
    expect(a.loanAmountCents).toBe(32_000_000);
    expect(b.loanAmountCents).toBe(30_000_000);
    expect(b.pitiaCents).toBeLessThan(a.pitiaCents);
    expect(b.dscrRatio!).toBeGreaterThan(a.dscrRatio!);
    expect(a.rateMilli).toBe(7_250);
    expect(a.rentForDscr120Cents).toBeGreaterThan(a.rentForDscr100Cents);
    // At the solved rent, DSCR reaches the target (rounded down), one cent less does not.
    const at = (rent: number) => listingSnapshot({ state: "TX", listPriceCents: 40_000_000, rentCents: rent, rateMilli: 7_250 }, DEFAULT_CONTEXT, [2_000])[0]!.dscrRatio!;
    expect(at(a.rentForDscr100Cents)).toBeGreaterThanOrEqual(10_000);
    expect(at(a.rentForDscr100Cents - 1)).toBeLessThan(10_000);
    expect(a.cashFlowCents).toBe(290_000 - a.pitiaCents);
  });
});
