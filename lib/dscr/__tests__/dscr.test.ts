/**
 * Hand-verified scenarios for lib/dscr.
 * Each case shows the arithmetic used to derive the expected value.
 * Amortization: PMT = L * r / (1 - (1 + r)^-n), r = annual% / 1200, n = 360.
 * At 7% the factor is 0.0058333 / (1 - 1.0058333^-360) = 0.00665302495 per $1.
 */
import { describe, expect, it } from "vitest";
import {
  SYSTEM_DEFAULTS,
  analyzeDeal,
  compareOptions,
  computeScenarioOption,
  dscr,
  escrowFromPrice,
  getVerdict,
  listingSnapshotNumbers,
  maxLoanAmount,
  maxPurchasePrice,
  minDownPayment,
  minRentForDscr,
  monthlyPI,
  monthlyPITIA,
  prepayExpiry,
  prepayPenaltyPct,
  rateDropSavings,
  remainingBalance,
  type BrokerDefaults,
} from "..";

const D: BrokerDefaults = { ...SYSTEM_DEFAULTS, minDscr: 1.0, maxLtv: 0.8, defaultRate: 7, taxRatePct: 1.2, insuranceRatePct: 0.5, borderlineBand: 0.1 };
// Standard deal: $400,000 price, 25% down => $300,000 loan at 7%.
// Taxes 1.2% * 400,000 / 12 = $400.00; insurance 0.5% * 400,000 / 12 = $166.67.
const escrow400 = escrowFromPrice(400_000, 1.2, 0.5);

describe("payments", () => {
  it("1. 30-year amortizing: $300,000 at 7% => $1,995.91", () => {
    expect(monthlyPI({ loanAmount: 300_000, ratePct: 7 })).toBeCloseTo(1995.91, 2);
  });

  it("2. 30-year amortizing: $240,000 at 7.5% => $1,678.11", () => {
    expect(monthlyPI({ loanAmount: 240_000, ratePct: 7.5 })).toBeCloseTo(1678.11, 2);
  });

  it("3. interest-only: $300,000 * 7% / 12 = $1,750.00", () => {
    expect(monthlyPI({ loanAmount: 300_000, ratePct: 7, interestOnly: true })).toBe(1750);
  });

  it("4. zero rate: $360,000 / 360 months = $1,000.00", () => {
    expect(monthlyPI({ loanAmount: 360_000, ratePct: 0 })).toBe(1000);
  });

  it("5. PITIA = 1,995.91 + 400.00 + 166.67 + 0 = $2,562.57", () => {
    expect(escrow400.taxesMonthly).toBeCloseTo(400, 2);
    expect(escrow400.insuranceMonthly).toBeCloseTo(166.67, 2);
    const pitia = monthlyPITIA(monthlyPI({ loanAmount: 300_000, ratePct: 7 }), escrow400);
    expect(pitia).toBeCloseTo(2562.57, 2);
  });
});

describe("DSCR and verdict", () => {
  it("6. rent $3,000 / PITIA $2,562.57 = 1.1707 => Likely", () => {
    const a = analyzeDeal({ price: 400_000, downPaymentPct: 0.25, monthlyRent: 3000 }, D);
    expect(a.dscr).toBeCloseTo(1.1707, 4);
    expect(a.verdict).toBe("LIKELY");
    expect(a.suggestions).toHaveLength(0);
  });

  it("7. DSCR < 1.0: rent $2,300 / 2,562.57 = 0.8975 => Unlikely (below 1.00 - 0.10)", () => {
    const a = analyzeDeal({ price: 400_000, downPaymentPct: 0.25, monthlyRent: 2300 }, D);
    expect(a.dscr).toBeCloseTo(0.8975, 4);
    expect(a.verdict).toBe("UNLIKELY");
    // Rent needed for DSCR 1.00 = PITIA = $2,562.57
    expect(a.rentForMinDscr).toBeCloseTo(2562.57, 2);
    expect(a.suggestions.some((s) => s.kind === "RENT")).toBe(true);
  });

  it("8. DSCR 0.9366 (rent $2,400) is within the 0.10 band => Borderline", () => {
    const a = analyzeDeal({ price: 400_000, downPaymentPct: 0.25, monthlyRent: 2400 }, D);
    expect(a.dscr).toBeCloseTo(0.9366, 4);
    expect(a.verdict).toBe("BORDERLINE");
  });

  it("9. interest-only + HOA: $250k, 20% down, 6% IO => 1,000 + 250 + 104.17 + 150 = 1,504.17; rent 1,800 => 1.1967", () => {
    const a = analyzeDeal({ price: 250_000, downPaymentPct: 0.2, monthlyRent: 1800, ratePct: 6, interestOnly: true, hoaMonthly: 150 }, D);
    expect(a.pi).toBe(1000);
    expect(a.pitia).toBeCloseTo(1504.17, 2);
    expect(a.dscr).toBeCloseTo(1.1967, 4);
  });

  it("10. FICO 660-679 caps LTV at 70%: DSCR fine but 75% LTV => Borderline with 30% down suggestion", () => {
    const a = analyzeDeal({ price: 400_000, downPaymentPct: 0.25, monthlyRent: 3000, fico: "660-679" }, D);
    expect(a.maxLtv).toBe(0.7);
    expect(a.verdict).toBe("BORDERLINE");
    expect(a.suggestions[0].title).toBe("Put at least 30% down");
  });

  it("11. FICO < 620 is not eligible => Unlikely regardless of DSCR", () => {
    const a = analyzeDeal({ price: 400_000, downPaymentPct: 0.4, monthlyRent: 5000, fico: "<620" }, D);
    expect(a.verdict).toBe("UNLIKELY");
    expect(a.suggestions[0].kind).toBe("FICO");
  });

  it("12. edge: zero PITIA => DSCR undefined (null)", () => {
    expect(dscr(2000, 0)).toBeNull();
    expect(getVerdict({ dscr: null, minDscr: 1, borderlineBand: 0.1, ltv: 0, maxLtv: 0.8 })).toBe("LIKELY");
  });

  it("13. edge: 100% down => loan 0, PITIA = 566.67, DSCR = 3,000 / 566.67 = 5.2941", () => {
    const a = analyzeDeal({ price: 400_000, downPaymentPct: 1, monthlyRent: 3000 }, D);
    expect(a.loanAmount).toBe(0);
    expect(a.pi).toBe(0);
    expect(a.dscr).toBeCloseTo(5.2941, 4);
  });

  it("14. edge: zero rent => DSCR 0, max loan 0, Unlikely", () => {
    const a = analyzeDeal({ price: 400_000, downPaymentPct: 0.25, monthlyRent: 0 }, D);
    expect(a.dscr).toBe(0);
    expect(a.maxLoan).toBe(0);
    expect(a.verdict).toBe("UNLIKELY");
  });

  it("15. edge: negative or invalid inputs throw", () => {
    expect(() => monthlyPI({ loanAmount: -1, ratePct: 7 })).toThrow(RangeError);
    expect(() => analyzeDeal({ price: 0, downPaymentPct: 0.2, monthlyRent: 2000 }, D)).toThrow(RangeError);
    expect(() => analyzeDeal({ price: 100_000, downPaymentPct: 1.2, monthlyRent: 2000 }, D)).toThrow(RangeError);
    expect(() => minRentForDscr(1000, 0)).toThrow(RangeError);
  });
});

describe("solvers", () => {
  const base = { price: 400_000, minDscr: 1.0, maxLtv: 0.8, ratePct: 7, escrow: escrow400 };

  it("16. max loan, LTV-limited: rent 3,000 => DSCR capacity (3,000 - 566.67) / 0.006653025 = $365,748; LTV cap $320,000 wins", () => {
    const r = maxLoanAmount({ ...base, monthlyRent: 3000 });
    expect(r.byDscr).toBeCloseTo(365_748.42, 0);
    expect(r.maxLoan).toBe(320_000);
    expect(r.limitedBy).toBe("LTV");
  });

  it("17. max loan, DSCR-limited: rent 2,500 => (2,500 - 566.67) / 0.006653025 = $290,595", () => {
    const r = maxLoanAmount({ ...base, monthlyRent: 2500 });
    expect(r.maxLoan).toBeCloseTo(290_594.63, 0);
    expect(r.limitedBy).toBe("DSCR");
  });

  it("18. min down payment at rent 2,500 => 1 - 290,595 / 400,000 = 27.35%", () => {
    const r = minDownPayment({ ...base, monthlyRent: 2500 });
    expect(r.pct).toBeCloseTo(0.27351, 4);
    expect(r.amount).toBeCloseTo(109_405.37, 0);
  });

  it("19. max purchase price: 2,500 / (0.006653025 * 0.75 + 1.7 / 1200) = $390,233", () => {
    const p = maxPurchasePrice({ monthlyRent: 2500, downPaymentPct: 0.25, minDscr: 1, ratePct: 7, taxRatePct: 1.2, insuranceRatePct: 0.5 });
    expect(p).toBeCloseTo(390_232.61, 0);
  });

  it("20. min rent for DSCR 1.25 at PITIA 2,562.57 => 3,203.22", () => {
    expect(minRentForDscr(2562.5741522, 1.25)).toBeCloseTo(3203.22, 2);
  });

  it("21. min DSCR higher than achievable with 0 rent capacity => max price 0", () => {
    expect(maxPurchasePrice({ monthlyRent: 100, downPaymentPct: 0.25, minDscr: 1, ratePct: 7, taxRatePct: 1.2, insuranceRatePct: 0.5, hoaMonthly: 200 })).toBe(0);
  });
});

describe("scenario options, prepay and refi", () => {
  it("22. option with 2 points and $1,500 fees on $300k purchase of $400k: cash to close = 100,000 + 6,000 + 1,500 = $107,500", () => {
    const r = computeScenarioOption({
      propertyValue: 400_000,
      monthlyRent: 3000,
      escrow: escrow400,
      isPurchase: true,
      option: { loanAmount: 300_000, ratePct: 7, termYears: 30, interestOnly: true, ioYears: 10, prepay: "5-4-3-2-1", pointsPct: 2, lenderFees: 1500 },
    });
    expect(r.cashToClose).toBe(107_500);
    expect(r.pi).toBe(1750);
    // After 10 IO years, amortize $300k over 20 years at 7% => $2,325.90
    expect(r.postIoPI).toBeCloseTo(2325.9, 2);
  });

  it("23. 5-4-3-2-1 prepay closed 2024-03-15: 14 months in => 4%; 58 months => 1%; 60 months => 0%", () => {
    const close = new Date(Date.UTC(2024, 2, 15));
    expect(prepayPenaltyPct("5-4-3-2-1", close, 5, new Date(Date.UTC(2025, 4, 20)))).toBe(4);
    expect(prepayPenaltyPct("5-4-3-2-1", close, 5, new Date(Date.UTC(2029, 0, 15)))).toBe(1);
    expect(prepayPenaltyPct("5-4-3-2-1", close, 5, new Date(Date.UTC(2029, 2, 15)))).toBe(0);
    expect(prepayExpiry(close, 5)?.toISOString().slice(0, 10)).toBe("2029-03-15");
    expect(prepayPenaltyPct("NONE", close, 0, new Date(Date.UTC(2024, 5, 1)))).toBe(0);
  });

  it("24. balance after 12 payments on $300k at 7% => $296,952.57", () => {
    expect(remainingBalance({ loanAmount: 300_000, ratePct: 7, monthsPaid: 12 })).toBeCloseTo(296_952.57, 1);
    expect(remainingBalance({ loanAmount: 300_000, ratePct: 7, monthsPaid: 12, interestOnly: true })).toBe(300_000);
  });

  it("25. rate drop IO $300k from 8% to 7%: 2,000 - 1,750 = $250/mo savings", () => {
    const r = rateDropSavings({ originalLoan: 300_000, currentRatePct: 8, marketRatePct: 7, monthsPaid: 24, interestOnly: true, penaltyPct: 3 });
    expect(r.monthlySavings).toBeCloseTo(250, 6);
    expect(r.penaltyCost).toBe(9000);
    expect(r.breakevenMonths).toBeCloseTo(36, 6);
  });

  it("26. listing snapshot at 20% down on $400k at 7%: loan 320,000 => P&I 2,128.97, PITIA 2,695.63", () => {
    const s = listingSnapshotNumbers({ price: 400_000, monthlyRent: 3000, ratePct: 7, escrow: escrow400 });
    expect(s.twenty.pi).toBeCloseTo(2128.97, 2);
    expect(s.twenty.pitia).toBeCloseTo(2695.63, 2);
    expect(s.twenty.rentForDscr12).toBeCloseTo(3234.76, 2);
    expect(s.twentyFive.pitia).toBeCloseTo(2562.57, 2);
  });

  const scen = (opt: Partial<Parameters<typeof computeScenarioOption>[0]["option"]>) =>
    computeScenarioOption({
      propertyValue: 400_000,
      monthlyRent: 3000,
      escrow: escrow400,
      isPurchase: true,
      option: { loanAmount: 300_000, ratePct: 7, termYears: 30, interestOnly: false, prepay: "5-4-3-2-1", pointsPct: 0, lenderFees: 1495, ...opt },
    });

  it("27. 5-year cost, amortizing: 1,495 fees + 60 × 2,562.57 = $155,249.45", () => {
    expect(scen({}).fiveYearCost).toBeCloseTo(155_249.45, 1);
  });

  it("28. 5-year cost, IO for 3 years: 36 × 2,316.67 + 24 × (2,063.44 P&I over 27 yrs + 566.67) = $146,522.68", () => {
    const r = scen({ interestOnly: true, ioYears: 3, lenderFees: 0 });
    expect(r.postIoPI).toBeCloseTo(2063.44, 2);
    expect(r.fiveYearCost).toBeCloseTo(146_522.68, 1);
  });

  it("29. points break-even: 1 point ($3,000) at 6.625% saves 2,562.57 − 2,487.60 = $74.97/mo → 40.0 months", () => {
    const a = scen({});
    const b = scen({ ratePct: 6.625, pointsPct: 1 });
    const c = compareOptions(a, b);
    expect(c.extraUpfront).toBe(3000);
    expect(c.monthlySavings).toBeCloseTo(74.97, 2);
    expect(c.breakEvenMonths).toBeCloseTo(40.01, 2);
    // Cheaper upfront and lower payment => nothing to break even.
    expect(compareOptions(b, a).breakEvenMonths).toBeNull();
  });
});
