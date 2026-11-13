import { analyzeDeal, minRentForDscr, type DealInput, type EngineContext } from "./analyze";
import type { FicoBucket, Prepay, Product, PropertyType, UsState, Verdict } from "./types";
import { applyRatio, type Cents, type Milli, type Ratio } from "./units";

/** Listing Snapshot (realtor flyer): the same property at two down payments, at one quoted rate. */
export interface ListingInput {
  state: UsState;
  propertyType?: PropertyType;
  listPriceCents: Cents;
  rentCents: Cents;
  taxesAnnualCents?: Cents | null;
  insuranceAnnualCents?: Cents | null;
  hoaMonthlyCents?: Cents;
  /** Quoted rate. Null = price from the broker's grid. */
  rateMilli?: Milli | null;
  fico?: FicoBucket;
  product?: Product;
  prepay?: Prepay;
}

export interface ListingColumn {
  downRatio: Ratio;
  downPaymentCents: Cents;
  loanAmountCents: Cents;
  rateMilli: Milli;
  piCents: Cents;
  taxesMonthlyCents: Cents;
  insuranceMonthlyCents: Cents;
  hoaMonthlyCents: Cents;
  pitiaCents: Cents;
  dscrRatio: Ratio | null;
  cashFlowCents: Cents;
  closingCostsCents: Cents;
  prepaidsCents: Cents;
  cashToCloseCents: Cents;
  reservesCents: Cents;
  totalCashNeededCents: Cents;
  verdict: Verdict;
  /** Monthly rent needed for DSCR 1.00 and 1.20 at this down payment. */
  rentForDscr100Cents: Cents;
  rentForDscr120Cents: Cents;
}

export const LISTING_DOWN_RATIOS: Ratio[] = [2_000, 2_500];

export function listingDealInput(l: ListingInput, downRatio: Ratio): DealInput {
  return {
    mode: "PURCHASE",
    state: l.state,
    fico: l.fico ?? "740+",
    propertyType: l.propertyType ?? "SFR",
    priceCents: l.listPriceCents,
    downPaymentRatio: downRatio,
    rentCents: l.rentCents,
    taxesAnnualCents: l.taxesAnnualCents ?? null,
    insuranceAnnualCents: l.insuranceAnnualCents ?? null,
    hoaMonthlyCents: l.hoaMonthlyCents ?? 0,
    product: l.product ?? "FIXED30",
    prepay: l.prepay ?? "5-4-3-2-1",
    rateMilliOverride: l.rateMilli ?? null,
  };
}

export function listingSnapshot(l: ListingInput, ctx: EngineContext, downRatios: Ratio[] = LISTING_DOWN_RATIOS): ListingColumn[] {
  return downRatios.map((d) => {
    const input = listingDealInput(l, d);
    const a = analyzeDeal(input, ctx, { solve: false });
    return {
      downRatio: d,
      downPaymentCents: a.downPaymentCents,
      loanAmountCents: a.loanAmountCents,
      rateMilli: a.rateMilli,
      piCents: a.piCents,
      taxesMonthlyCents: a.taxesMonthlyCents,
      insuranceMonthlyCents: a.insuranceMonthlyCents,
      hoaMonthlyCents: a.hoaMonthlyCents,
      pitiaCents: a.pitiaCents,
      dscrRatio: a.dscrRatio,
      cashFlowCents: a.cashFlowCents,
      closingCostsCents: a.closingCostsCents,
      prepaidsCents: a.prepaidsCents,
      cashToCloseCents: a.cashToCloseCents,
      reservesCents: a.reservesCents,
      totalCashNeededCents: a.totalCashNeededCents,
      verdict: a.verdict,
      rentForDscr100Cents: minRentForDscr(input, ctx, 10_000),
      rentForDscr120Cents: minRentForDscr(input, ctx, 12_000),
    };
  });
}

/** State-table escrow estimate for a value (used when the listing has no tax record or insurance quote). */
export function estimateEscrow(state: UsState, valueCents: Cents, ctx: EngineContext): { taxesAnnualCents: Cents; insuranceAnnualCents: Cents } {
  const st = ctx.stateDefaults[state];
  return { taxesAnnualCents: applyRatio(valueCents, st.taxRatio), insuranceAnnualCents: applyRatio(valueCents, st.insuranceRatio) };
}
