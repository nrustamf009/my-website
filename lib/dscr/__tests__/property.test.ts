/** Property-based tests: invariants that must hold for any deal, not just the golden ones. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_CONTEXT, FICO_BUCKETS, PREPAYS, PRODUCTS, analyzeDeal, balanceAfter, prepayPenaltyCents, prepayTermMonths, productPayments, verdictRank, type DealInput } from "..";

const deal = fc.record({
  price: fc.integer({ min: 150_000, max: 1_500_000 }).map((d) => d * 100),
  downRatio: fc.integer({ min: 1_500, max: 4_500 }),
  rent: fc.integer({ min: 800, max: 12_000 }).map((d) => d * 100),
  fico: fc.constantFrom(...FICO_BUCKETS),
  product: fc.constantFrom(...PRODUCTS),
  prepay: fc.constantFrom(...PREPAYS),
});

const toInput = (d: { price: number; downRatio: number; rent: number; fico: (typeof FICO_BUCKETS)[number]; product: (typeof PRODUCTS)[number]; prepay: (typeof PREPAYS)[number] }): DealInput => ({
  mode: "PURCHASE",
  state: "OH",
  fico: d.fico,
  priceCents: d.price,
  downPaymentRatio: d.downRatio,
  rentCents: d.rent,
  product: d.product,
  prepay: d.prepay,
});

const run = (i: DealInput) => analyzeDeal(i, DEFAULT_CONTEXT, { solve: false });

describe("engine invariants", () => {
  it("more down payment never lowers DSCR", () => {
    fc.assert(
      fc.property(deal, fc.integer({ min: 50, max: 2_000 }), (d, extra) => {
        const a = run(toInput(d));
        const b = run({ ...toInput(d), downPaymentRatio: Math.min(10_000, d.downRatio + extra) });
        expect(b.dscrRatio ?? Infinity).toBeGreaterThanOrEqual(a.dscrRatio ?? Infinity);
      }),
      { numRuns: 300 },
    );
  });

  it("more rent never lowers DSCR or the verdict tier", () => {
    fc.assert(
      fc.property(deal, fc.integer({ min: 1, max: 2_000 }).map((d) => d * 100), (d, extra) => {
        const a = run(toInput(d));
        const b = run({ ...toInput(d), rentCents: d.rent + extra });
        expect(b.dscrRatio ?? Infinity).toBeGreaterThanOrEqual(a.dscrRatio ?? Infinity);
        expect(verdictRank(b.verdict === "NEEDS_ADJUSTMENT" ? "NOT_ELIGIBLE" : b.verdict)).toBeGreaterThanOrEqual(verdictRank(a.verdict === "NEEDS_ADJUSTMENT" ? "NOT_ELIGIBLE" : a.verdict));
      }),
      { numRuns: 300 },
    );
  });

  it("a higher rate never lowers the payment", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PRODUCTS), fc.integer({ min: 10_000, max: 3_000_000 }).map((d) => d * 100), fc.integer({ min: 0, max: 15_000 }), fc.integer({ min: 1, max: 2_000 }), (p, loan, rate, bump) => {
        expect(productPayments(p, loan, rate + bump).initialPI).toBeGreaterThanOrEqual(productPayments(p, loan, rate).initialPI);
      }),
    );
  });

  it("cash to close grows with the down payment; PITIA components are non-negative integers", () => {
    fc.assert(
      fc.property(deal, (d) => {
        const a = run(toInput(d));
        const b = run({ ...toInput(d), downPaymentRatio: d.downRatio + 500 });
        expect(b.cashToCloseCents).toBeGreaterThanOrEqual(a.cashToCloseCents);
        for (const v of [a.piCents, a.taxesMonthlyCents, a.insuranceMonthlyCents, a.pitiaCents, a.cashToCloseCents, a.reservesCents]) {
          expect(Number.isInteger(v) && v >= 0).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("every 'what to change' suggestion actually reaches its promised tier", () => {
    fc.assert(
      fc.property(deal, (d) => {
        const input = toInput(d);
        const a = analyzeDeal(input, DEFAULT_CONTEXT);
        for (const w of a.whatToChange) {
          const v =
            w.lever === "DOWN_PAYMENT" ? { downPaymentCents: w.to } : w.lever === "PRICE" ? { priceCents: w.to, downPaymentRatio: input.downPaymentRatio } : w.lever === "RENT" ? { rentCents: w.to } : { pointsRatio: w.to };
          const after = run({ ...input, ...v });
          expect(verdictRank(after.verdict)).toBeGreaterThanOrEqual(verdictRank(w.reaches));
        }
      }),
      { numRuns: 60 },
    );
  });

  it("balance never increases over time; prepay penalty is zero after the term", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PRODUCTS), fc.constantFrom(...PREPAYS), fc.integer({ min: 0, max: 359 }), (p, pp, m) => {
        expect(balanceAfter(p, 300_000_00, 7_000, m + 1)).toBeLessThanOrEqual(balanceAfter(p, 300_000_00, 7_000, m));
        expect(prepayPenaltyCents(pp, 250_000_00, prepayTermMonths(pp) + 1 + m)).toBe(0);
      }),
    );
  });
});
