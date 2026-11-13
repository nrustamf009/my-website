/**
 * Every investor- and realtor-facing string (public pages, PDFs, emails, outreach footers).
 * Spanish (v2) adds lib/strings/es.ts with the same shape.
 * Banned in this file and in all UI: approved, pre-approved, pre-qualified, qualifies, guaranteed
 * (and "commitment" except inside the required disclaimer negation in lib/compliance).
 */
import type { Lever, Mode, Prepay, Product, PropertyType, ReasonCode, Verdict } from "@/lib/dscr";

export const en = {
  verdict: {
    STRONG: "Looks strong",
    BORDERLINE: "Borderline",
    NEEDS_ADJUSTMENT: "Needs adjustment",
    NOT_ELIGIBLE: "Not eligible under current defaults",
  } satisfies Record<Verdict, string>,
  verdictHelp: {
    STRONG: "Rent covers the estimated payment comfortably and leverage is within typical program limits.",
    BORDERLINE: "Within typical limits, with little room to spare. Small changes could matter.",
    NEEDS_ADJUSTMENT: "Outside typical limits as entered, but a change below would bring it in range.",
    NOT_ELIGIBLE: "Outside the program defaults used for this estimate. A loan officer can review other options.",
  } satisfies Record<Verdict, string>,
  mode: { PURCHASE: "Purchase", RATE_TERM: "Rate & term refinance", CASH_OUT: "Cash-out refinance" } satisfies Record<Mode, string>,
  product: {
    FIXED30: "30-yr fixed",
    IO30: "30-yr fixed, 10-yr interest-only",
    IO40: "40-yr fixed, 10-yr interest-only",
    ARM5_6: "5/6 ARM (payment shown for the 5-yr fixed period)",
    ARM7_6: "7/6 ARM (payment shown for the 7-yr fixed period)",
  } satisfies Record<Product, string>,
  productShort: { FIXED30: "30-yr fixed", IO30: "30-yr · 10-yr IO", IO40: "40-yr · 10-yr IO", ARM5_6: "5/6 ARM", ARM7_6: "7/6 ARM" } satisfies Record<Product, string>,
  prepay: {
    "5-4-3-2-1": "5-4-3-2-1 (5 years)",
    "3-2-1": "3-2-1 (3 years)",
    "5-5-5-5-5": "5% for 5 years",
    "3-3-3": "3% for 3 years",
    "2-1": "2-1 (2 years)",
    "1": "1% for 1 year",
    NONE: "No prepayment penalty",
  } satisfies Record<Prepay, string>,
  prepayExplainer: {
    "5-4-3-2-1": "Selling or refinancing in years 1–5 costs 5%, 4%, 3%, 2%, then 1% of the balance. Usually buys a lower rate.",
    "3-2-1": "Selling or refinancing in years 1–3 costs 3%, 2%, then 1% of the balance.",
    "5-5-5-5-5": "Selling or refinancing in the first 5 years costs 5% of the balance.",
    "3-3-3": "Selling or refinancing in the first 3 years costs 3% of the balance.",
    "2-1": "Selling or refinancing in year 1 costs 2%, in year 2 costs 1% of the balance.",
    "1": "Selling or refinancing in the first year costs 1% of the balance.",
    NONE: "No fee to sell or refinance at any time. Most flexible, usually a slightly higher rate.",
  } satisfies Record<Prepay, string>,
  propertyType: { SFR: "Single-family", "2-4": "2–4 units", CONDO: "Condo", TOWNHOME: "Townhome" } satisfies Record<PropertyType, string>,
  reason: {
    FICO_BELOW_FLOOR: "Credit score is below the program minimum used for this estimate.",
    LOAN_BELOW_MIN: "Loan amount is below the program minimum.",
    LOAN_ABOVE_MAX: "Loan amount is above the program maximum.",
    LTV_ABOVE_CAP: "Loan-to-value is above the limit for this credit range.",
    DSCR_BELOW_MIN: "Rent doesn't cover the estimated payment at the program minimum.",
    DSCR_NOT_ELIGIBLE: "Rent covers less than 75% of the estimated payment.",
    CASH_OUT_NOT_SEASONED: "Most cash-out programs need at least 6 months of ownership.",
    CASH_OUT_PURCHASE_PRICE_CAP: "Owned under 12 months: value is capped at the purchase price.",
    RENT_LEASE_LOWER: "On refinances, lenders use the lower of the lease and market rent.",
    STR_NOTE: "Short-term rentals: most programs use long-term market rent or an appraiser's STR analysis.",
  } satisfies Record<ReasonCode, string>,
  lever: {
    DOWN_PAYMENT: (to: string) => `Put ${to} down`,
    PRICE: (to: string) => `Negotiate the price to ${to}`,
    RENT: (to: string) => `Rent of ${to}/mo or more`,
    BUYDOWN: (to: string) => `Buy down the rate with ${to}`,
    CASH_OUT: (to: string) => `Take ${to} cash out instead`,
    PAYDOWN: (to: string) => `Pay the loan down to ${to}`,
  } satisfies Record<Lever, (to: string) => string>,
  leverNote: {
    DOWN_PAYMENT: (cost: string) => `About ${cost} more cash at closing.`,
    PRICE: () => "No extra cash; depends on the seller.",
    RENT: () => "No extra cash; confirm with a rent comparison or an existing lease.",
    BUYDOWN: (cost: string) => `About ${cost} in points (assumes 1 point ≈ 0.25% lower rate).`,
    CASH_OUT: () => "Less cash back, but a lower payment.",
    PAYDOWN: (cost: string) => `About ${cost} brought to closing.`,
  } satisfies Record<Lever, (cost: string) => string>,
  stretch: "Bigger change",

  check: {
    eyebrow: "DSCR Instant Check",
    title: "Will rent cover the loan on this rental?",
    subtitle: "DSCR loans for investment properties are based on the property's rent, not your tax returns. Enter the deal to see an instant estimate.",
    calculate: "Calculate",
    adjust: "Adjust assumptions",
    rentNote: "Lenders use the appraiser's rent schedule; this is an estimate.",
    placeholder: "Enter a price and rent to see your estimate.",
    pdfTitle: "Get the full PDF estimate",
    pdfSubtitle: "Payment breakdown, cash needed, and what would change the outcome, sent to your inbox.",
    submit: "Email me the PDF estimate",
    estimateOnly: "Estimate only. Not an offer or commitment to lend.",
  },
  listing: {
    eyebrow: "Investor Financing Snapshot",
    formTitle: "Get a financing estimate for this property",
    formBody: (lo: string) => `DSCR loans qualify the property on its rent, not your personal income. ${lo} will confirm the numbers and walk you through options.`,
    submit: "Get my financing estimate",
    shared: (realtor: string, brokerage: string) => `Listing shared by ${realtor}, ${brokerage}`,
  },
  scenario: {
    eyebrow: (name: string) => `Loan options for ${name}`,
    expired: "This scenario has expired. Ask your loan officer for updated pricing.",
    revoked: "This scenario is no longer available.",
    pricingAsOf: (date: string, until: string) => `Pricing as of ${date}. Valid until ${until}; rates change daily and are confirmed when you lock.`,
    interested: (label: string) => `I'm interested in Option ${label}`,
    switchTo: (label: string) => `Switch to Option ${label}`,
    picked: (label: string, lo: string) => `You picked Option ${label}. ${lo} has been notified.`,
    questionLabel: "Anything you'd like to ask? (optional)",
    nextSteps: "What happens next",
    glossary: "What these terms mean",
  },
  form: {
    name: "Full name",
    email: "Email",
    phone: "Mobile phone",
    noSsn: (lo: string) => `No credit check. No SSN. Your info goes only to ${lo}.`,
    successTitle: "Check your inbox",
    successBody: (email: string, lo: string) => `We sent your estimate to ${email}. ${lo} will reach out to walk you through it.`,
  },
  footer: {
    eho: "Equal Housing Opportunity",
    nmlsConsumerAccess: "NMLS Consumer Access",
    licensedIn: (s: string) => `Licensed in ${s}`,
    privacy: "Privacy policy",
    disclaimerVersion: (v: number) => `Disclaimer v${v}`,
  },
  glossary: [
    ["DSCR", "Debt Service Coverage Ratio: monthly rent ÷ monthly payment. 1.00 means rent exactly covers the payment."],
    ["PITIA", "The full monthly payment: principal, interest, taxes, insurance and HOA dues."],
    ["LTV", "Loan-to-value: the loan as a percentage of the price or value."],
    ["Points", "An optional upfront fee (1 point = 1% of the loan) paid to lower the rate. A lender credit works the other way."],
    ["Prepayment penalty", "A fee if you sell or refinance early. Accepting one usually lowers the rate."],
    ["Interest-only", "For the first years you pay only interest. Afterwards the payment rises to pay off the loan."],
    ["Reserves", "Cash lenders want to see in your accounts after closing, usually several months of payments."],
  ] as [string, string][],
  sms: {
    optOut: "Reply STOP to opt out.",
  },
};

export type Strings = typeof en;
export const t = en;
