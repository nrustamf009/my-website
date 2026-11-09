import type { BrokerDefaults, Escrow, FicoRange, Verdict } from "./types";
import { assertNonNegative, assertPositive, assertRatio, ceilTo, floorTo } from "./guards";
import { dscr as calcDscr, escrowFromPrice, monthlyPI, monthlyPITIA } from "./payment";
import { maxLoanAmount, maxPurchasePrice, minDownPayment, minRentForDscr } from "./solvers";
import { effectiveMaxLtv, getVerdict } from "./eligibility";

export interface DealInput {
  price: number;
  downPaymentPct: number;
  monthlyRent: number;
  fico?: FicoRange | null;
  ratePct?: number;
  termYears?: number;
  interestOnly?: boolean;
  /** Overrides; default to % of price from broker defaults. */
  taxesMonthly?: number;
  insuranceMonthly?: number;
  hoaMonthly?: number;
}

export interface Suggestion {
  kind: "DOWN_PAYMENT" | "RENT" | "PRICE" | "INTEREST_ONLY" | "FICO";
  title: string;
  detail: string;
}

export interface DealAnalysis {
  price: number;
  downPaymentPct: number;
  downPayment: number;
  loanAmount: number;
  ltv: number;
  ratePct: number;
  termYears: number;
  interestOnly: boolean;
  monthlyRent: number;
  pi: number;
  escrow: Escrow;
  pitia: number;
  dscr: number | null;
  minDscr: number;
  maxLtv: number;
  verdict: Verdict;
  maxLoan: number;
  maxLoanLimitedBy: "DSCR" | "LTV";
  minDownPaymentPct: number;
  rentForMinDscr: number;
  maxPriceAtDown: number;
  suggestions: Suggestion[];
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function resolveEscrow(input: DealInput, defaults: BrokerDefaults): Escrow {
  const base = escrowFromPrice(input.price, defaults.taxRatePct, defaults.insuranceRatePct, input.hoaMonthly ?? 0);
  return {
    taxesMonthly: input.taxesMonthly ?? base.taxesMonthly,
    insuranceMonthly: input.insuranceMonthly ?? base.insuranceMonthly,
    hoaMonthly: input.hoaMonthly ?? 0,
  };
}

/** Full analysis used by the Instant Check, Listing Snapshot and Call-to-Scenario. */
export function analyzeDeal(input: DealInput, defaults: BrokerDefaults): DealAnalysis {
  assertPositive("price", input.price);
  assertRatio("downPaymentPct", input.downPaymentPct);
  assertNonNegative("monthlyRent", input.monthlyRent);

  const ratePct = input.ratePct ?? defaults.defaultRate;
  const termYears = input.termYears ?? defaults.termYears;
  const interestOnly = input.interestOnly ?? false;
  const escrow = resolveEscrow(input, defaults);
  const downPayment = input.price * input.downPaymentPct;
  const loanAmount = input.price - downPayment;
  const ltv = loanAmount / input.price;
  const pi = monthlyPI({ loanAmount, ratePct, termYears, interestOnly });
  const pitia = monthlyPITIA(pi, escrow);
  const ratio = calcDscr(input.monthlyRent, pitia);
  const maxLtv = effectiveMaxLtv(defaults, input.fico);
  const verdict = getVerdict({ dscr: ratio, minDscr: defaults.minDscr, borderlineBand: defaults.borderlineBand, ltv, maxLtv });

  const sizing = { price: input.price, monthlyRent: input.monthlyRent, minDscr: defaults.minDscr, maxLtv, ratePct, termYears, interestOnly, escrow };
  const ml = maxLoanAmount(sizing);
  const md = minDownPayment(sizing);
  const rentForMinDscr = minRentForDscr(pitia, defaults.minDscr);
  const maxPriceAtDown = maxPurchasePrice({
    monthlyRent: input.monthlyRent,
    downPaymentPct: Math.max(input.downPaymentPct, 1 - maxLtv),
    minDscr: defaults.minDscr,
    ratePct,
    termYears,
    interestOnly,
    taxRatePct: defaults.taxRatePct,
    insuranceRatePct: defaults.insuranceRatePct,
    hoaMonthly: escrow.hoaMonthly,
  });

  const suggestions: Suggestion[] = [];
  if (verdict !== "LIKELY") {
    if (maxLtv <= 0) {
      suggestions.push({
        kind: "FICO",
        title: "Credit score is below most DSCR programs",
        detail: "Most DSCR lenders need a 620+ score. A short credit-improvement plan can open more options.",
      });
    } else {
      if (ltv > maxLtv + 1e-9) {
        suggestions.push({
          kind: "DOWN_PAYMENT",
          title: `Put at least ${pct(1 - maxLtv)} down`,
          detail: `With your credit range, lenders typically cap the loan at ${pct(maxLtv)} of the price.`,
        });
      }
      if (ratio !== null && ratio < defaults.minDscr) {
        const neededDown = ceilTo(md.pct, 0.01);
        if (md.limitedBy === "DSCR" && neededDown < 1 && neededDown > input.downPaymentPct) {
          suggestions.push({
            kind: "DOWN_PAYMENT",
            title: `Increase down payment to ${pct(neededDown)}`,
            detail: `About ${usd(neededDown * input.price)} down brings the DSCR to ${defaults.minDscr.toFixed(2)}.`,
          });
        }
        suggestions.push({
          kind: "RENT",
          title: `Rent of ${usd(ceilTo(rentForMinDscr, 5))}/mo or more`,
          detail: `At the current price and down payment, rent needs to cover ${defaults.minDscr.toFixed(2)}x the monthly payment.`,
        });
        if (Number.isFinite(maxPriceAtDown) && maxPriceAtDown > 0 && maxPriceAtDown < input.price) {
          suggestions.push({
            kind: "PRICE",
            title: `Target a price around ${usd(floorTo(maxPriceAtDown, 1000))}`,
            detail: `At this rent and down payment, that is the highest price that still reaches DSCR ${defaults.minDscr.toFixed(2)}.`,
          });
        }
        if (!interestOnly && loanAmount > 0) {
          const ioPitia = monthlyPITIA(monthlyPI({ loanAmount, ratePct, termYears, interestOnly: true }), escrow);
          const ioDscr = calcDscr(input.monthlyRent, ioPitia);
          if (ioDscr !== null && ioDscr >= defaults.minDscr) {
            suggestions.push({
              kind: "INTEREST_ONLY",
              title: "Consider an interest-only option",
              detail: `Interest-only lowers the payment to about ${usd(ioPitia)}/mo and lifts the DSCR to ${ioDscr.toFixed(2)}.`,
            });
          }
        }
      }
    }
  }

  return {
    price: input.price,
    downPaymentPct: input.downPaymentPct,
    downPayment,
    loanAmount,
    ltv,
    ratePct,
    termYears,
    interestOnly,
    monthlyRent: input.monthlyRent,
    pi,
    escrow,
    pitia,
    dscr: ratio,
    minDscr: defaults.minDscr,
    maxLtv,
    verdict,
    maxLoan: ml.maxLoan,
    maxLoanLimitedBy: ml.limitedBy,
    minDownPaymentPct: md.pct,
    rentForMinDscr,
    maxPriceAtDown,
    suggestions,
  };
}

/** Numbers used by the Listing Snapshot PDF and property page. */
export function listingSnapshotNumbers(params: {
  price: number;
  monthlyRent: number;
  ratePct: number;
  termYears?: number;
  escrow: Escrow;
}) {
  const { price, monthlyRent, ratePct, termYears = 30, escrow } = params;
  const at = (down: number) => {
    const loanAmount = price * (1 - down);
    const pi = monthlyPI({ loanAmount, ratePct, termYears });
    const pitia = monthlyPITIA(pi, escrow);
    return {
      downPaymentPct: down,
      downPayment: price * down,
      loanAmount,
      pi,
      pitia,
      dscr: calcDscr(monthlyRent, pitia),
      rentForDscr1: minRentForDscr(pitia, 1.0),
      rentForDscr12: minRentForDscr(pitia, 1.2),
    };
  };
  return { twenty: at(0.2), twentyFive: at(0.25) };
}
