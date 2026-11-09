import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { escrowFromPrice } from "@/lib/dscr";
import { parseJson } from "@/lib/broker";
import type { CallExtraction } from "@/lib/providers/ai";
import { defaultOption, type ScenarioInput } from "@/lib/scenario-schema";
import { Notice, PageHeader } from "@/components/ui";
import { ScenarioEditor } from "@/components/scenarios/ScenarioEditor";

export const metadata = { title: "New scenario" };

export default async function NewScenario({ searchParams }: { searchParams: Promise<{ leadId?: string; callId?: string }> }) {
  const { broker } = await requireBroker();
  const { leadId, callId } = await searchParams;
  const base: ScenarioInput = {
    investorName: "",
    investorEmail: "",
    investorPhone: "",
    propertyAddress: "",
    loanPurpose: "PURCHASE",
    propertyValue: 0,
    monthlyRent: 0,
    taxesMonthly: 0,
    insuranceMonthly: 0,
    hoaMonthly: 0,
    note: "",
    options: [],
  };
  let source: string | null = null;

  if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, brokerId: broker.id } });
    if (lead) {
      source = `Prefilled from ${lead.name}'s lead.`;
      Object.assign(base, { investorName: lead.name, investorEmail: lead.email, investorPhone: lead.phone ?? "", propertyAddress: lead.propertyAddress ?? "", propertyValue: lead.purchasePrice ?? 0, monthlyRent: lead.monthlyRent ?? 0 });
    }
  }
  if (callId) {
    const call = await prisma.callSession.findFirst({ where: { id: callId, brokerId: broker.id } });
    const x = parseJson<CallExtraction | null>(call?.extraction, null);
    if (x) {
      source = "Prefilled from your call. Review every number before sharing.";
      Object.assign(base, {
        investorName: x.investor.name ?? "",
        investorEmail: x.investor.email ?? "",
        investorPhone: x.investor.phone ?? "",
        propertyAddress: x.deal.propertyAddress ?? "",
        loanPurpose: x.deal.loanPurpose ?? "PURCHASE",
        propertyValue: x.deal.purchasePrice ?? 0,
        monthlyRent: x.deal.monthlyRent ?? 0,
        taxesMonthly: x.deal.taxesMonthly ?? 0,
        insuranceMonthly: x.deal.insuranceMonthly ?? 0,
        hoaMonthly: x.deal.hoaMonthly ?? 0,
      });
    }
  }
  if (base.propertyValue && !base.taxesMonthly) {
    const esc = escrowFromPrice(base.propertyValue, broker.taxRatePct, broker.insuranceRatePct);
    base.taxesMonthly = Math.round(esc.taxesMonthly);
    base.insuranceMonthly = Math.round(esc.insuranceMonthly);
  }
  base.options = [defaultOption("A", base.propertyValue, broker.defaultRate, 0), defaultOption("B", base.propertyValue, broker.defaultRate, 1)];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New scenario" subtitle="Compare 2–3 loan options side by side. The investor gets a branded page and a PDF." />
      {source && <div className="mb-4"><Notice tone="accent">{source}</Notice></div>}
      <ScenarioEditor id={null} initial={base} taxRatePct={broker.taxRatePct} insuranceRatePct={broker.insuranceRatePct} defaultRate={broker.defaultRate} callId={callId ?? null} />
    </div>
  );
}
