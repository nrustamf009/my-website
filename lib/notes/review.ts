import { z } from "zod/v4";
import { PROPERTY_TYPES, US_STATES } from "@/lib/dscr";
import type { NotesExtraction } from "@/lib/providers/ai";
import { parseDollarsToCents } from "@/lib/format";

/** The LO-reviewed version of an extraction. Money in cents; taxes/insurance monthly as stated. */
export const NotesReviewSchema = z.object({
  investorName: z.string().trim().min(2, "Enter the investor's name").max(80),
  investorEmail: z.union([z.literal(""), z.email("Enter a valid email")]),
  investorPhone: z.string().trim().max(30),
  experience: z.string().trim().max(200),
  mode: z.enum(["PURCHASE", "RATE_TERM", "CASH_OUT"]),
  propertyAddress: z.string().trim().min(6, "Enter the property address").max(200),
  state: z.enum(US_STATES as [string, ...string[]], "Choose the state"),
  propertyType: z.enum(PROPERTY_TYPES as [string, ...string[]]),
  use: z.enum(["LTR", "STR"]),
  entity: z.enum(["LLC", "PERSONAL", ""]),
  valueCents: z.number().int().min(5_000_000, "Enter the price or value").max(5_000_000_000),
  currentBalanceCents: z.number().int().min(0).nullable(),
  downPaymentPercent: z.number().min(0).max(100).nullable(),
  rentCents: z.number().int().min(10_000, "Enter the monthly rent").max(10_000_000),
  taxesMonthlyCents: z.number().int().min(0).nullable(),
  insuranceMonthlyCents: z.number().int().min(0).nullable(),
  hoaMonthlyCents: z.number().int().min(0),
  ficoScore: z.number().int().min(300).max(850).nullable(),
  wantsInterestOnly: z.boolean().nullable(),
  prepayPreference: z.enum(["5-4-3-2-1", "3-2-1", "NONE", ""]),
  timeline: z.string().trim().max(200),
  summary: z.string().trim().max(600),
  goals: z.array(z.string().trim().max(240)).max(8),
  objections: z.array(z.string().trim().max(240)).max(8),
  nextSteps: z.array(z.string().trim().max(240)).max(8),
  missingInfo: z.array(z.string().trim().max(240)).max(10),
});
export type NotesReview = z.infer<typeof NotesReviewSchema>;
export type NotesReviewDraft = Omit<NotesReview, "valueCents" | "rentCents" | "state"> & { valueCents: number | null; rentCents: number | null; state: string };

const cents = (d: number | null) => (d == null ? null : parseDollarsToCents(String(d)));

export function reviewFromExtraction(x: NotesExtraction, defaultState?: string): NotesReviewDraft {
  const d = x.deal;
  const st = d.state && (US_STATES as string[]).includes(d.state.toUpperCase()) ? d.state.toUpperCase() : (defaultState ?? "");
  return {
    investorName: x.investor.name ?? "",
    investorEmail: x.investor.email ?? "",
    investorPhone: x.investor.phone ?? "",
    experience: x.investor.experience ?? "",
    mode: d.loanPurpose ?? "PURCHASE",
    propertyAddress: d.propertyAddress ?? "",
    state: st,
    propertyType: d.propertyType ?? "SFR",
    use: d.use ?? "LTR",
    entity: x.entity ?? "",
    valueCents: cents(d.priceOrValueDollars),
    currentBalanceCents: cents(d.currentBalanceDollars),
    downPaymentPercent: d.downPaymentPercent,
    rentCents: cents(d.monthlyRentDollars),
    taxesMonthlyCents: cents(d.taxesMonthlyDollars),
    insuranceMonthlyCents: cents(d.insuranceMonthlyDollars),
    hoaMonthlyCents: cents(d.hoaMonthlyDollars) ?? 0,
    ficoScore: d.ficoScore,
    wantsInterestOnly: d.wantsInterestOnly,
    prepayPreference: d.prepayPreference ?? "",
    timeline: x.timeline ?? "",
    summary: x.summary,
    goals: x.goals,
    objections: x.objections,
    nextSteps: x.nextSteps,
    missingInfo: x.missingInfo,
  };
}
