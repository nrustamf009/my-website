import type { Lead, Scenario, ScenarioOption } from "@prisma/client";
import type { BuilderInitial } from "@/components/scenarios/Builder";
import { parseJson } from "@/lib/broker";
import { isFicoBucket, isUsState, type FicoBucket, type Mode, type Prepay, type Product, type UsState } from "@/lib/dscr";
import type { CheckForm } from "@/lib/check/form";

export const DEFAULT_LENDER_FEES_CENTS = 149_500;

export function blankInitial(state?: string): BuilderInitial {
  return { investorName: "", investorEmail: "", investorPhone: "", mode: "PURCHASE", propertyAddress: "", state: state && isUsState(state) ? state : "", propertyType: "SFR", use: "LTR", valueCents: null, currentBalanceCents: null, rentCents: null, taxesAnnualCents: null, insuranceAnnualCents: null, hoaMonthlyCents: 0, ficoBucket: "740+", note: "", options: null };
}

/** Prefill from an Instant Check lead's saved form. */
export function initialFromLead(lead: Lead): BuilderInitial {
  const f = parseJson<Partial<CheckForm>>(lead.engineInput, {});
  const purchase = f.mode !== "CASH_OUT";
  return {
    ...blankInitial(lead.state ?? undefined),
    leadId: lead.id,
    investorName: lead.name,
    investorEmail: lead.email,
    investorPhone: lead.phone ?? "",
    mode: purchase ? "PURCHASE" : "CASH_OUT",
    propertyAddress: lead.propertyAddress ?? f.address ?? "",
    propertyType: f.propertyType ?? "SFR",
    use: f.use === "STR" ? "STR" : "LTR",
    valueCents: (purchase ? f.priceCents : f.valueCents) ?? null,
    currentBalanceCents: purchase ? null : (f.currentBalanceCents ?? null),
    rentCents: f.rentCents ?? null,
    taxesAnnualCents: f.taxesAnnualCents ?? null,
    insuranceAnnualCents: f.insuranceAnnualCents ?? null,
    hoaMonthlyCents: f.hoaMonthlyCents ?? 0,
    ficoBucket: isFicoBucket(f.fico) ? f.fico : "740+",
    downRatio: f.downPaymentRatio ?? 2_500,
  };
}

export function initialFromScenario(s: Scenario & { options: ScenarioOption[] }): BuilderInitial {
  return {
    id: s.id,
    investorName: s.investorName,
    investorEmail: s.investorEmail ?? "",
    investorPhone: s.investorPhone ?? "",
    mode: s.mode as Mode,
    propertyAddress: s.propertyAddress,
    state: s.state as UsState,
    propertyType: s.propertyType,
    use: s.use === "STR" ? "STR" : "LTR",
    valueCents: s.valueCents,
    currentBalanceCents: s.currentBalanceCents,
    rentCents: s.rentCents,
    taxesAnnualCents: s.taxesAnnualCents,
    insuranceAnnualCents: s.insuranceAnnualCents,
    hoaMonthlyCents: s.hoaMonthlyCents,
    ficoBucket: (isFicoBucket(s.ficoBucket) ? s.ficoBucket : "740+") as FicoBucket,
    note: s.note ?? "",
    options: [...s.options].sort((a, b) => a.sortOrder - b.sortOrder).map((o) => ({ product: o.product as Product, loanAmountCents: o.loanAmountCents, rateMilli: o.rateMilli, pointsRatio: o.pointsRatio, feesCents: o.feesCents, prepay: o.prepay as Prepay, recommended: o.recommended })),
  };
}
