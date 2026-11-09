import { z } from "zod/v4";
import { FICO_RANGES } from "@/lib/dscr";

const money = (label: string, max = 50_000_000) =>
  z.coerce.number({ error: `Enter ${label}` }).finite().min(0, `${label} can't be negative`).max(max, `${label} looks too large`);

export const DealInputSchema = z.object({
  address: z.string().trim().min(5, "Enter the property address").max(200),
  price: money("a purchase price").min(10_000, "Enter a purchase price of at least $10,000"),
  downPaymentPct: z.coerce.number().min(0, "Down payment can't be negative").max(1, "Down payment can't exceed 100%"),
  monthlyRent: money("the monthly rent", 1_000_000),
  fico: z.enum(FICO_RANGES as [string, ...string[]]).nullable().optional(),
  ratePct: z.coerce.number().min(0).max(25).optional(),
  interestOnly: z.coerce.boolean().optional(),
  hoaMonthly: money("HOA", 100_000).optional(),
});

export const CONSENT_TEXT =
  "I agree to be contacted by the loan officer named on this page by phone, text message, or email about my financing request, including by automated means. Consent is not a condition of any purchase. Message and data rates may apply.";

export const LeadContactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.email("Enter a valid email").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number")
    .optional(),
  consent: z.literal(true, { error: "Please check the box so we can contact you" }),
  /** Honeypot: must stay empty. */
  company: z.string().max(0).optional(),
  /** Milliseconds the form was open; bots submit instantly. */
  elapsedMs: z.coerce.number().optional(),
});

export const PublicLeadSchema = z.object({
  source: z.enum(["CHECK", "LISTING"]),
  snapshotToken: z.string().optional(),
  deal: DealInputSchema,
  contact: LeadContactSchema,
});

export type PublicLeadInput = z.infer<typeof PublicLeadSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
