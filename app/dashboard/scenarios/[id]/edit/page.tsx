import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, features } from "@/lib/broker";
import { DEFAULT_LENDER_FEES_CENTS, initialFromScenario } from "@/lib/scenario-builder";
import { Notice, PageHeader } from "@/components/ui";
import { ScenarioBuilder } from "@/components/scenarios/Builder";

export const metadata = { title: "Edit scenario" };

export default async function EditScenario({ params }: { params: Promise<{ id: string }> }) {
  const { broker, db } = await requireBroker();
  if (!features(broker).scenario) redirect("/dashboard");
  const { id } = await params;
  const s = await db.scenario.findFirst({ where: { id }, include: { options: true } });
  if (!s) notFound();
  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/dashboard/scenarios/${s.id}`} className="text-sm text-muted hover:text-ink">← Back</Link>
      <PageHeader title={`Edit: ${s.propertyAddress}`} />
      {s.status === "SHARED" && <div className="mb-4"><Notice tone="warn">This scenario is already shared. Changes show up on the investor&apos;s link right away.</Notice></div>}
      <ScenarioBuilder ctx={engineContext(broker)} initial={initialFromScenario(s)} feesDefaultCents={DEFAULT_LENDER_FEES_CENTS} />
    </div>
  );
}
