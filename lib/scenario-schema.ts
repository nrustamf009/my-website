import { z } from "zod/v4";
import { loanFromLtv } from "@/lib/dscr";

const OptionInput = z.object({
  label: z.enum(["A", "B", "C"]),
  loanAmount: z.coerce.number().min(10_000, "Loan amount must be at least $10,000").max(20_000_000),
  ratePct: z.coerce.number().min(0.5, "Enter a rate").max(20, "Rate looks too high"),
  termYears: z.coerce.number().int().refine((v) => [30, 40].includes(v), "Term must be 30 or 40 years"),
  interestOnly: z.boolean(),
  ioYears: z.coerce.number().int().min(1).max(15).nullable(),
  prepay: z.enum(["5-4-3-2-1", "3-2-1", "NONE"]),
  pointsPct: z.coerce.number().min(0).max(5, "Points look too high"),
  lenderFees: z.coerce.number().min(0).max(100_000),
});

export const ScenarioInputSchema = z.object({
  investorName: z.string().trim().min(2, "Enter the investor's name").max(100),
  investorEmail: z.union([z.literal(""), z.email("Enter a valid email")]),
  investorPhone: z.string().trim().max(30),
  propertyAddress: z.string().trim().min(5, "Enter the property address").max(200),
  loanPurpose: z.enum(["PURCHASE", "RATE_TERM", "CASH_OUT"]),
  propertyValue: z.coerce.number().min(10_000, "Enter the price or value").max(50_000_000),
  monthlyRent: z.coerce.number().min(0).max(1_000_000),
  taxesMonthly: z.coerce.number().min(0).max(100_000),
  insuranceMonthly: z.coerce.number().min(0).max(100_000),
  hoaMonthly: z.coerce.number().min(0).max(100_000),
  note: z.string().max(1000),
  options: z.array(OptionInput).min(2, "Add at least 2 options").max(3, "Up to 3 options"),
});

export type ScenarioInput = z.infer<typeof ScenarioInputSchema>;

type Opt = ScenarioInput["options"][number];

/** Sensible starting options: A = baseline, B = buy-down, C = interest-only. */
export function defaultOption(label: "A" | "B" | "C", value: number, rate: number, variant = 0): Opt {
  return {
    label,
    loanAmount: value ? loanFromLtv(value, 0.75) : 0,
    ratePct: Math.max(0, rate + [0, -0.375, 0.25][variant]!),
    termYears: 30,
    interestOnly: variant === 2,
    ioYears: variant === 2 ? 10 : null,
    prepay: variant === 2 ? "3-2-1" : "5-4-3-2-1",
    pointsPct: variant === 1 ? 1 : 0,
    lenderFees: 1495,
  };
}

