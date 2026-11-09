import { z } from "zod/v4";

export const CallExtractionSchema = z.object({
  summary: z.string().describe("Two-sentence summary of the call."),
  investor: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    experience: z.string().nullable().describe("e.g. 'Owns 3 rentals', 'First investment property'"),
  }),
  deal: z.object({
    propertyAddress: z.string().nullable(),
    loanPurpose: z.enum(["PURCHASE", "RATE_TERM", "CASH_OUT"]).nullable(),
    purchasePrice: z.number().nullable().describe("Purchase price or estimated property value in USD"),
    loanAmount: z.number().nullable().describe("Requested loan amount in USD if stated"),
    downPaymentPct: z.number().nullable().describe("Down payment as a decimal, e.g. 0.25"),
    monthlyRent: z.number().nullable().describe("Expected or actual monthly rent in USD"),
    ficoRange: z.enum(["760+", "720-759", "680-719", "660-679", "620-659", "<620"]).nullable(),
    propertyType: z.string().nullable(),
    units: z.number().nullable(),
    wantsInterestOnly: z.boolean().nullable(),
    prepayPreference: z.enum(["5-4-3-2-1", "3-2-1", "NONE"]).nullable(),
    targetRatePct: z.number().nullable(),
    taxesMonthly: z.number().nullable(),
    insuranceMonthly: z.number().nullable(),
    hoaMonthly: z.number().nullable(),
  }),
  goals: z.array(z.string()),
  objections: z.array(z.string()),
  nextSteps: z.array(z.string()),
  missingInfo: z.array(z.string()).describe("Information still needed to quote the loan"),
});

export type CallExtraction = z.infer<typeof CallExtractionSchema>;

export const FollowUpEmailSchema = z.object({
  subject: z.string(),
  body: z.string().describe("Plain-text email body, no markdown"),
});

export type FollowUpEmail = z.infer<typeof FollowUpEmailSchema>;
