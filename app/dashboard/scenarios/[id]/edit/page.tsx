import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ScenarioEditor } from "@/components/scenarios/ScenarioEditor";

export default async function EditScenario({ params }: { params: Promise<{ id: string }> }) {
  const { broker } = await requireBroker();
  const { id } = await params;
  const s = await prisma.scenario.findFirst({ where: { id, brokerId: broker.id }, include: { options: { orderBy: { sortOrder: "asc" } } } });
  if (!s) notFound();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Edit scenario · ${s.investorName}`} subtitle="Changes apply to the same share link." />
      <ScenarioEditor
        id={s.id}
        taxRatePct={broker.taxRatePct}
        insuranceRatePct={broker.insuranceRatePct}
        defaultRate={broker.defaultRate}
        initial={{
          investorName: s.investorName,
          investorEmail: s.investorEmail ?? "",
          investorPhone: s.investorPhone ?? "",
          propertyAddress: s.propertyAddress,
          loanPurpose: s.loanPurpose as "PURCHASE",
          propertyValue: s.propertyValue,
          monthlyRent: s.monthlyRent,
          taxesMonthly: s.taxesMonthly,
          insuranceMonthly: s.insuranceMonthly,
          hoaMonthly: s.hoaMonthly,
          note: s.note ?? "",
          options: s.options.map((o) => ({ label: o.label as "A", loanAmount: o.loanAmount, ratePct: o.ratePct, termYears: o.termYears, interestOnly: o.interestOnly, ioYears: o.ioYears, prepay: o.prepay as "NONE", pointsPct: o.pointsPct, lenderFees: o.lenderFees, recommended: o.recommended })),
        }}
      />
    </div>
  );
}
