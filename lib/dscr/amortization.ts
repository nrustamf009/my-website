import type { Product } from "./types";
import { assertCents, assertMilli, roundHalfUp, type Cents, type Milli } from "./units";

export interface ProductSpec {
  termMonths: number;
  /** Interest-only months at the start (0 for amortizing). */
  ioMonths: number;
  /** ARM initial fixed period in months (null for fixed-rate). */
  fixedMonths: number | null;
}

export const PRODUCT_SPECS: Record<Product, ProductSpec> = {
  FIXED30: { termMonths: 360, ioMonths: 0, fixedMonths: null },
  IO30: { termMonths: 360, ioMonths: 120, fixedMonths: null },
  IO40: { termMonths: 480, ioMonths: 120, fixedMonths: null },
  ARM5_6: { termMonths: 360, ioMonths: 0, fixedMonths: 60 },
  ARM7_6: { termMonths: 360, ioMonths: 0, fixedMonths: 84 },
};

const monthlyRate = (rateMilli: Milli) => rateMilli / 100_000 / 12;

/** Fully amortizing monthly P&I, rounded half-up to cents. */
export function amortizingPayment(loanCents: Cents, rateMilli: Milli, termMonths: number): Cents {
  assertCents("loanCents", loanCents);
  assertMilli("rateMilli", rateMilli);
  if (loanCents === 0) return 0;
  const r = monthlyRate(rateMilli);
  if (r === 0) return roundHalfUp(loanCents / termMonths);
  return roundHalfUp((loanCents * r) / (1 - Math.pow(1 + r, -termMonths)));
}

/** Interest-only monthly payment, rounded half-up to cents. */
export function interestOnlyPayment(loanCents: Cents, rateMilli: Milli): Cents {
  assertCents("loanCents", loanCents);
  assertMilli("rateMilli", rateMilli);
  return roundHalfUp(loanCents * monthlyRate(rateMilli));
}

export interface ProductPayments {
  /** Payment used for DSCR: the initial payment (IO payment for IO products). */
  initialPI: Cents;
  /** Amortizing payment after the IO period (IO products only). */
  postIoPI: Cents | null;
  spec: ProductSpec;
}

export function productPayments(product: Product, loanCents: Cents, rateMilli: Milli): ProductPayments {
  const spec = PRODUCT_SPECS[product];
  if (spec.ioMonths > 0) {
    return {
      initialPI: interestOnlyPayment(loanCents, rateMilli),
      postIoPI: amortizingPayment(loanCents, rateMilli, spec.termMonths - spec.ioMonths),
      spec,
    };
  }
  return { initialPI: amortizingPayment(loanCents, rateMilli, spec.termMonths), postIoPI: null, spec };
}

/** Remaining principal after `monthsPaid` scheduled payments (IO period keeps the balance flat). */
export function balanceAfter(product: Product, loanCents: Cents, rateMilli: Milli, monthsPaid: number): Cents {
  const spec = PRODUCT_SPECS[product];
  if (monthsPaid <= 0) return loanCents;
  if (monthsPaid <= spec.ioMonths) return loanCents;
  const amortTerm = spec.termMonths - spec.ioMonths;
  const k = Math.min(monthsPaid - spec.ioMonths, amortTerm);
  const r = monthlyRate(rateMilli);
  if (r === 0) return roundHalfUp(loanCents * (1 - k / amortTerm));
  const pmt = (loanCents * r) / (1 - Math.pow(1 + r, -amortTerm));
  const g = Math.pow(1 + r, k);
  return Math.max(0, roundHalfUp(loanCents * g - (pmt * (g - 1)) / r));
}
