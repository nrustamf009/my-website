import { z } from "zod/v4";
import { FICO_BUCKETS, PREPAYS, PRODUCTS, PROPERTY_TYPES, US_STATES } from "@/lib/dscr";
import { BANNED_WORDS } from "@/lib/compliance/banned-words";

const cents = z.number().int().min(0).max(5_000_000_000);
const OptionSchema = z.object({
  product: z.enum(PRODUCTS as [string, ...string[]]),
  loanAmountCents: z.number().int().min(5_000_000, "Loan must be at least $50,000").max(5_000_000_000),
  rateMilli: z.number().int().min(2_000, "Rate looks too low").max(15_000, "Rate looks too high"),
  pointsRatio: z.number().int().min(-300).max(400),
  feesCents: cents,
  prepay: z.enum(PREPAYS as [string, ...string[]]),
  recommended: z.boolean(),
});

export const ScenarioInputSchema = z
  .object({
    id: z.string().optional(),
    investorName: z.string().trim().min(2, "Enter the investor's name").max(80),
    investorEmail: z.union([z.literal(""), z.email("Enter a valid email")]),
    investorPhone: z.string().trim().max(30),
    leadId: z.string().optional(),
    mode: z.enum(["PURCHASE", "RATE_TERM", "CASH_OUT"]),
    propertyAddress: z.string().trim().min(6, "Enter the property address").max(200),
    state: z.enum(US_STATES as [string, ...string[]]),
    propertyType: z.enum(PROPERTY_TYPES as [string, ...string[]]),
    use: z.enum(["LTR", "STR"]),
    valueCents: z.number().int().min(5_000_000, "Enter the price or value").max(5_000_000_000),
    currentBalanceCents: cents.nullable(),
    rentCents: z.number().int().min(10_000, "Enter the monthly rent").max(10_000_000),
    taxesAnnualCents: cents,
    insuranceAnnualCents: cents,
    hoaMonthlyCents: cents,
    ficoBucket: z.enum(FICO_BUCKETS as [string, ...string[]]),
    note: z.string().trim().max(1_000).refine((v) => !BANNED_WORDS.test(v), "Avoid words like approved, pre-qualified or guaranteed"),
    options: z.array(OptionSchema).min(2, "Add at least two options").max(3, "Up to three options"),
  })
  .refine((d) => d.options.every((o) => o.loanAmountCents <= d.valueCents), { message: "A loan amount is higher than the value", path: ["options"] });

export type ScenarioInput = z.input<typeof ScenarioInputSchema>;
