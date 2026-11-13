import { DEFAULT_CONTEXT, analyzeDeal, computeScenarioOption, compareOptions, defaultScenarioLoan, type DealInput, type ScenarioOptionInput, type ScenarioPropertyInput } from "@/lib/dscr";
import type { PublicBrand } from "@/lib/broker";
import { DEFAULT_DISCLAIMER } from "@/lib/compliance/disclaimers";

/**
 * Golden fixture (DESIGN.md §11). Inputs only: every figure the gallery shows is computed by lib/dscr.
 * Where the engine disagrees with the table in DESIGN.md (rounding, prepaids), the engine wins.
 */
export const FIXTURE_DEAL: DealInput = {
  mode: "PURCHASE",
  state: "OH",
  fico: "740+",
  propertyType: "SFR",
  priceCents: 38_500_000,
  downPaymentRatio: 2_500,
  rentCents: 295_000,
  taxesAnnualCents: 449 * 1200,
  insuranceAnnualCents: 130 * 1200,
  hoaMonthlyCents: 0,
  product: "FIXED30",
  prepay: "3-2-1",
  rateMilliOverride: 7_125,
};

export const FIXTURE_ADDRESS = "1842 Calloway St, Columbus, OH 43206";

export function fixtureAnalysis() {
  return analyzeDeal(FIXTURE_DEAL, DEFAULT_CONTEXT);
}

export function fixtureScenario() {
  const p: ScenarioPropertyInput = { mode: "PURCHASE", valueCents: 38_500_000, rentCents: 295_000, taxesAnnualCents: 449 * 1200, insuranceAnnualCents: 130 * 1200, hoaMonthlyCents: 0 };
  const loan = defaultScenarioLoan("PURCHASE", p.valueCents, 2_500);
  const opts: (ScenarioOptionInput & { label: string; recommended: boolean })[] = [
    { label: "A", recommended: false, product: "FIXED30", loanAmountCents: loan, rateMilli: 7_125, pointsRatio: 0, feesCents: 0, prepay: "3-2-1" },
    { label: "B", recommended: true, product: "IO30", loanAmountCents: loan, rateMilli: 7_375, pointsRatio: 0, feesCents: 0, prepay: "5-4-3-2-1" },
    { label: "C", recommended: false, product: "FIXED30", loanAmountCents: loan, rateMilli: 6_750, pointsRatio: 125, feesCents: 0, prepay: "5-4-3-2-1" },
  ];
  const results = opts.map((o) => computeScenarioOption(p, o, DEFAULT_CONTEXT.grid));
  return opts.map((o, i) => ({ ...o, result: results[i]!, vsFirst: i ? compareOptions(results[0]!, results[i]!, opts[0]!, o) : null }));
}

export function fixtureBrand(theme: PublicBrand["theme"], accent: string): PublicBrand {
  return {
    brokerId: "fixture",
    slug: "fixture",
    theme,
    companyName: "Alder & Vane Capital",
    companyNmlsId: "7654321",
    logoUrl: null,
    accentColor: accent,
    accentText: accent,
    onAccent: "#FFFFFF",
    phone: "(555) 010-0000",
    email: "dana@aldervane.example",
    websiteUrl: null,
    privacyPolicyUrl: null,
    licensedStates: ["OH", "IN", "TN", "GA"],
    disclaimer: { id: null, version: 1, text: DEFAULT_DISCLAIMER },
    lo: { id: null, slug: null, name: "Dana Whitlock", title: "Senior Loan Officer", nmlsId: "1234567", phone: "(555) 010-0000", email: "dana@aldervane.example", headshotUrl: null },
    isDemo: true,
  };
}
