import type { ClosedLoan } from "@prisma/client";
import type { LoanEvaluation, Trigger } from "@/lib/dscr";
import { rate, shortDate, usd } from "@/lib/format";
import type { PublicBrand } from "@/lib/broker";
import { t } from "@/lib/strings/en";
import type { OutreachFacts } from "@/lib/providers/ai";

/** Display-only: turns an engine evaluation into labels and investor-facing sentences. No math here. */
export interface Opportunity {
  headline: string;
  /** "$14,800" or "Review" / "Check-in". */
  benefitLabel: string;
  benefitHint: string;
  kind: LoanEvaluation["benefitKind"];
  reasons: string[];
  benefit: string | null;
  netOf: string | null;
}

export function triggerText(tr: Trigger): string {
  switch (tr.kind) {
    case "PREPAY":
      return tr.days > 0 ? `Your prepayment penalty ends on ${shortDate(tr.date)}` : `Your prepayment penalty ended on ${shortDate(tr.date)}`;
    case "SEASONING":
      return tr.detail?.valueBasis === "APPRAISED"
        ? `You passed ${tr.detail.months} months of ownership, so most lenders can now use today's appraised value`
        : `You passed ${tr.detail?.months} months of ownership, so a cash-out refinance is now possible`;
    case "RATE":
      return "Rates for loans like yours are below your current rate";
    case "ARM_RESET":
      return `Your ARM's first rate adjustment is on ${shortDate(tr.date)}`;
    case "ANNIVERSARY":
      return `Your loan turns ${Math.round((tr.detail?.months ?? 12) / 12)} on ${shortDate(tr.date)}`;
  }
}

export function triggerShort(tr: Trigger): string {
  switch (tr.kind) {
    case "PREPAY":
      return tr.days > 0 ? `Prepay ends in ${tr.days}d` : `Prepay ended ${-tr.days}d ago`;
    case "SEASONING":
      return `${tr.detail?.months}-mo seasoning`;
    case "RATE":
      return `Rate −${rate(tr.detail?.rateDeltaMilli ?? 0)}`;
    case "ARM_RESET":
      return `ARM resets in ${tr.days}d`;
    case "ANNIVERSARY":
      return "Anniversary";
  }
}

export function describeOpportunity(ev: LoanEvaluation, horizonMonths: number): Opportunity {
  const reasons = ev.triggers.map(triggerText);
  const headline = reasons[0] ?? "No trigger right now";
  const costs: string[] = [];
  if (ev.benefitKind === "SAVINGS") {
    if (ev.penaltyTodayCents > 0) costs.push(`a ${usd(ev.penaltyTodayCents)} prepayment penalty`);
    costs.push(`estimated closing costs of ${usd(ev.refiCostsCents)}`);
    return {
      headline,
      benefitLabel: usd(ev.estimatedBenefitCents),
      benefitHint: `${horizonMonths} months${ev.breakevenMonth ? ` · even in month ${ev.breakevenMonth}` : ""}`,
      kind: ev.benefitKind,
      reasons,
      benefit: `Refinancing could lower the payment by about ${usd(ev.monthlySavingsCents)}/mo`,
      netOf: `net of ${costs.join(" and ")}`,
    };
  }
  if (ev.benefitKind === "CASH_OUT") {
    if (ev.penaltyTodayCents > 0) costs.push(`a ${usd(ev.penaltyTodayCents)} prepayment penalty`);
    costs.push(`estimated closing costs of ${usd(ev.cashOutCostsCents)}`);
    return {
      headline,
      benefitLabel: usd(ev.cashOutNetCents),
      benefitHint: "est. cash out, net",
      kind: ev.benefitKind,
      reasons,
      benefit: `A cash-out refinance could free up about ${usd(ev.cashOutNetCents)}`,
      netOf: `net of ${costs.join(" and ")}`,
    };
  }
  const checkIn = ev.triggers.every((x) => x.kind === "ANNIVERSARY");
  // Savings that take longer than the horizon to recover are shown to the LO, never pitched to the client.
  const slow = ev.monthlySavingsCents > 0 && ev.breakevenMonth ? `${usd(ev.monthlySavingsCents)}/mo, breakeven month ${ev.breakevenMonth}` : null;
  return { headline, benefitLabel: checkIn ? "Check-in" : "Review", benefitHint: slow ?? (checkIn ? "relationship touch" : "no dollar estimate"), kind: "NONE", reasons, benefit: null, netOf: null };
}

export function outreachFacts(loan: ClosedLoan, op: Opportunity, brand: PublicBrand): OutreachFacts {
  return {
    loName: brand.lo.name,
    companyName: brand.companyName,
    borrowerFirstName: loan.borrowerName.split(/\s+/)[0] ?? loan.borrowerName,
    propertyAddress: loan.propertyAddress,
    reasons: op.reasons.length ? op.reasons : ["It has been a while since we closed your loan"],
    benefit: op.benefit,
    netOf: op.netOf,
  };
}

/** Compliance footer appended by code (never generated). */
export function emailFooter(brand: PublicBrand): string {
  const lo = brand.lo;
  return [
    "",
    "—",
    `${lo.name}${lo.title ? `, ${lo.title}` : ""}${lo.nmlsId ? ` · NMLS #${lo.nmlsId}` : ""}`,
    `${brand.companyName} · NMLS #${brand.companyNmlsId}`,
    [lo.phone, lo.email].filter(Boolean).join(" · "),
    "Figures are estimates based on today's market and your original loan terms, not a loan offer. Rates, terms and eligibility depend on a full application and underwriting.",
    t.footer.eho,
  ].join("\n");
}

export function smsFooter(brand: PublicBrand): string {
  return ` ${brand.lo.name.split(" ")[0]}${brand.lo.nmlsId ? ` NMLS #${brand.lo.nmlsId}` : ""}, ${brand.companyName} NMLS #${brand.companyNmlsId}. ${t.sms.optOut}`;
}
