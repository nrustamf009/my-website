import { z } from "zod/v4";
import { FICO_BUCKETS, PREPAYS, PRODUCTS, PROPERTY_TYPES, isUsState, type DealInput, type UsState } from "@/lib/dscr";

/** Investor-facing deal form. All money in cents, ratios ×10,000 (no math happens in components). */
export const CheckFormSchema = z.object({
  mode: z.enum(["PURCHASE", "CASH_OUT"]),
  address: z.string().trim().min(5, "Enter the property address").max(200),
  state: z.string().refine((s) => isUsState(s), "Choose the property's state"),
  propertyType: z.enum(PROPERTY_TYPES as [string, ...string[]]),
  units: z.coerce.number().int().min(1).max(4).default(1),
  use: z.enum(["LTR", "STR"]).default("LTR"),
  fico: z.enum(FICO_BUCKETS as [string, ...string[]]),
  priceCents: z.coerce.number().int().min(25_000_00, "Enter a price of at least $25,000").max(50_000_000_00).optional(),
  downPaymentRatio: z.coerce.number().int().min(0).max(10_000).optional(),
  valueCents: z.coerce.number().int().min(25_000_00, "Enter the estimated value").max(50_000_000_00).optional(),
  currentBalanceCents: z.coerce.number().int().min(0).max(50_000_000_00).optional(),
  cashOutCents: z.coerce.number().int().min(0).max(50_000_000_00).optional(),
  monthsOwned: z.coerce.number().int().min(0).max(600).optional(),
  purchasePriceCents: z.coerce.number().int().min(0).max(50_000_000_00).optional(),
  rentCents: z.coerce.number().int().min(100_00, "Enter the expected monthly rent").max(1_000_000_00),
  taxesAnnualCents: z.coerce.number().int().min(0).max(5_000_000_00).nullable().optional(),
  insuranceAnnualCents: z.coerce.number().int().min(0).max(5_000_000_00).nullable().optional(),
  hoaMonthlyCents: z.coerce.number().int().min(0).max(100_000_00).optional(),
  product: z.enum(PRODUCTS as [string, ...string[]]).default("FIXED30"),
  prepay: z.enum(PREPAYS as [string, ...string[]]).default("5-4-3-2-1"),
});

export type CheckForm = z.infer<typeof CheckFormSchema>;

export function toDealInput(f: CheckForm): DealInput {
  const common = {
    state: f.state as UsState,
    fico: f.fico as DealInput["fico"],
    propertyType: f.propertyType as DealInput["propertyType"],
    units: f.units,
    use: f.use,
    rentCents: f.rentCents,
    taxesAnnualCents: f.taxesAnnualCents ?? null,
    insuranceAnnualCents: f.insuranceAnnualCents ?? null,
    hoaMonthlyCents: f.hoaMonthlyCents ?? 0,
    product: f.product as DealInput["product"],
    prepay: f.prepay as DealInput["prepay"],
  };
  return f.mode === "PURCHASE"
    ? { ...common, mode: "PURCHASE", priceCents: f.priceCents, downPaymentRatio: f.downPaymentRatio ?? 2_500 }
    : { ...common, mode: "CASH_OUT", valueCents: f.valueCents, currentBalanceCents: f.currentBalanceCents ?? 0, cashOutCents: f.cashOutCents ?? 0, monthsOwned: f.monthsOwned ?? 24, purchasePriceCents: f.purchasePriceCents ?? null };
}

/** Is the form complete enough to analyze? */
export function isAnalyzable(f: Partial<CheckForm>): f is CheckForm {
  return CheckFormSchema.safeParse(f).success;
}

/** Parse a GET query (no-JS fallback / shareable links) into a partial form. */
export function formFromQuery(q: Record<string, string | string[] | undefined>, defaults: Partial<CheckForm>): Partial<CheckForm> {
  const g = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : q[k]) as string | undefined;
  const num = (k: string) => {
    const v = g(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const out: Partial<CheckForm> = { ...defaults };
  for (const k of ["mode", "address", "state", "propertyType", "use", "fico", "product", "prepay"] as const) if (g(k)) (out as Record<string, unknown>)[k] = g(k);
  for (const k of ["units", "priceCents", "downPaymentRatio", "valueCents", "currentBalanceCents", "cashOutCents", "monthsOwned", "purchasePriceCents", "rentCents", "taxesAnnualCents", "insuranceAnnualCents", "hoaMonthlyCents"] as const) {
    const n = num(k);
    if (n !== undefined) (out as Record<string, unknown>)[k] = n;
  }
  return out;
}

export const LeadContactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.email("Enter a valid email").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number"),
  consentContact: z.literal(true, { error: "Please check the box so we can contact you" }),
  consentMarketing: z.boolean().default(false),
  investmentProperty: z.literal(true, { error: "DSCR loans are for investment properties only" }),
  company: z.string().max(0).optional(),
  elapsedMs: z.number().optional(),
});

export const PublicLeadSchema = z.object({
  source: z.enum(["WIDGET", "SNAPSHOT"]),
  snapshotToken: z.string().max(64).optional(),
  lo: z.string().max(64).optional(),
  form: CheckFormSchema,
  contact: LeadContactSchema,
  turnstileToken: z.string().max(4096).nullable().optional(),
  utm: z.record(z.string(), z.string().max(200)).optional(),
  referrer: z.string().max(500).optional(),
});

export type PublicLeadInput = z.infer<typeof PublicLeadSchema>;

export function e164(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
