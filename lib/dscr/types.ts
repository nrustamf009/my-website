import type { Cents, Milli, Ratio } from "./units";

export type Mode = "PURCHASE" | "RATE_TERM" | "CASH_OUT";
export const MODES: Mode[] = ["PURCHASE", "RATE_TERM", "CASH_OUT"];

export type Product = "FIXED30" | "IO30" | "IO40" | "ARM5_6" | "ARM7_6";
export const PRODUCTS: Product[] = ["FIXED30", "IO30", "IO40", "ARM5_6", "ARM7_6"];

export type Prepay = "5-4-3-2-1" | "3-2-1" | "5-5-5-5-5" | "3-3-3" | "2-1" | "1" | "NONE";
export const PREPAYS: Prepay[] = ["5-4-3-2-1", "3-2-1", "5-5-5-5-5", "3-3-3", "2-1", "1", "NONE"];

export type FicoBucket = "740+" | "700-739" | "680-699" | "660-679" | "<660";
export const FICO_BUCKETS: FicoBucket[] = ["740+", "700-739", "680-699", "660-679", "<660"];

export type DscrBucket = ">=1.20" | "1.00-1.19" | "0.75-0.99" | "<0.75";
export const DSCR_BUCKETS: DscrBucket[] = [">=1.20", "1.00-1.19", "0.75-0.99", "<0.75"];

export type PropertyType = "SFR" | "2-4" | "CONDO" | "TOWNHOME";
export const PROPERTY_TYPES: PropertyType[] = ["SFR", "2-4", "CONDO", "TOWNHOME"];

export type PropertyUse = "LTR" | "STR";

export type Verdict = "STRONG" | "BORDERLINE" | "NEEDS_ADJUSTMENT" | "NOT_ELIGIBLE";

export type UsState =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "DC" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS"
  | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NY" | "NC"
  | "ND" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY";

export interface ProgramGrid {
  baseRateMilli: Milli;
  /** null = not eligible for this FICO × DSCR × mode cell. */
  maxLtvRatio: Record<Mode, Record<FicoBucket, Record<DscrBucket, Ratio | null>>>;
  rateAdjMilli: {
    fico: Record<FicoBucket, Milli>;
    dscr: Record<DscrBucket, Milli>;
    product: Record<Product, Milli>;
    prepay: Record<Prepay, Milli>;
    mode: Record<Mode, Milli>;
  };
  subOneDscrEnabled: boolean;
  minLoanCents: Cents;
  maxLoanCents: Cents;
  ficoFloor: number;
  strongDscrRatio: Ratio;
  minDscrRatio: Ratio;
  reservesMonths: number;
  closingCostRatio: { purchase: Ratio; refi: Ratio };
  prepaids: { insuranceMonths: number; taxMonths: number };
  /** Rate reduction per 1 point of buydown (assumption used by the "what to change" solver). */
  buydownMilliPerPoint: Milli;
  cashOutSeasoningMonths: { purchasePriceCap: number; appraisedValue: number };
}

export interface StateDefault {
  /** Annual property tax as ratio of value. */
  taxRatio: Ratio;
  /** Annual landlord insurance as ratio of value. */
  insuranceRatio: Ratio;
}
