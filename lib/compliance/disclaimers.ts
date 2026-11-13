/**
 * Required compliance text. This is the ONLY place the word "commitment" may appear
 * (as the required negation "not a commitment to lend"). Guard test enforces this.
 */
export const DEFAULT_DISCLAIMER =
  "Estimate only. This is not a commitment to lend, a loan offer, or an approval of credit. Rates, terms and programs are subject to change without notice. Not all applicants will qualify. Property values, rents, taxes and insurance shown are estimates and will be verified during underwriting and appraisal. DSCR loans are business-purpose loans for non-owner-occupied investment properties.";

export const CONSENT_VERSION = "2026-11-v1";

export const CONSENT_TEXT = {
  CONTACT: (company: string) =>
    `By checking this box, I give ${company} and its loan officers my express written consent to contact me about my financing request at the phone number and email I provided, including by calls and text messages using automated technology or prerecorded/artificial voice. Consent is not a condition of any purchase or loan. Message and data rates may apply. Reply STOP to opt out of texts.`,
  MARKETING: (company: string) => `Send me occasional market updates and investor tips from ${company} by email. Unsubscribe anytime.`,
  INVESTMENT_PROPERTY: "This is an investment property. I will not live in it.",
} as const;

export type ConsentKind = keyof typeof CONSENT_TEXT;
