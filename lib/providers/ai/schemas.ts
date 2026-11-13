import { z } from "zod/v4";

/** Notes-to-Scenario extraction. Numbers only when stated in the text (never computed by the model). */
export const NotesExtractionSchema = z.object({
  summary: z.string().describe("Two sentences, plain English, no numbers that were not in the text."),
  investor: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    experience: z.string().nullable().describe("e.g. 'Owns 4 rentals' or 'First investment property'"),
  }),
  deal: z.object({
    propertyAddress: z.string().nullable(),
    state: z.string().nullable().describe("Two-letter US state if known"),
    loanPurpose: z.enum(["PURCHASE", "RATE_TERM", "CASH_OUT"]).nullable(),
    propertyType: z.enum(["SFR", "2-4", "CONDO", "TOWNHOME"]).nullable(),
    units: z.number().int().nullable(),
    use: z.enum(["LTR", "STR"]).nullable(),
    priceOrValueDollars: z.number().nullable().describe("Purchase price or estimated value as stated"),
    currentBalanceDollars: z.number().nullable(),
    cashOutDollars: z.number().nullable(),
    downPaymentPercent: z.number().nullable().describe("As stated, e.g. 25 for 25%"),
    monthlyRentDollars: z.number().nullable(),
    taxesMonthlyDollars: z.number().nullable(),
    insuranceMonthlyDollars: z.number().nullable(),
    hoaMonthlyDollars: z.number().nullable(),
    ficoScore: z.number().int().nullable(),
    wantsInterestOnly: z.boolean().nullable(),
    prepayPreference: z.enum(["5-4-3-2-1", "3-2-1", "NONE"]).nullable(),
    monthsOwned: z.number().int().nullable(),
  }),
  entity: z.enum(["LLC", "PERSONAL"]).nullable(),
  timeline: z.string().nullable().describe("e.g. 'Closing in 5 weeks'"),
  goals: z.array(z.string()),
  objections: z.array(z.string()),
  nextSteps: z.array(z.string()),
  missingInfo: z.array(z.string()),
});
export type NotesExtraction = z.infer<typeof NotesExtractionSchema>;

export const OutreachSchema = z.object({
  emailSubject: z.string(),
  emailBody: z.string().describe("Plain text, no signature, no disclaimer (added by the system)"),
  sms: z.string().describe("Under 300 characters, no signature, no opt-out line (added by the system)"),
});
export type OutreachDraft = z.infer<typeof OutreachSchema>;

export const FollowUpEmailSchema = z.object({ subject: z.string(), body: z.string() });
export type FollowUpEmail = z.infer<typeof FollowUpEmailSchema>;
