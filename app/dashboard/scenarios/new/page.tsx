import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, features, licensedStates } from "@/lib/broker";
import { blankInitial, DEFAULT_LENDER_FEES_CENTS, initialFromLead } from "@/lib/scenario-builder";
import { PageHeader } from "@/components/ui";
import { ScenarioBuilder } from "@/components/scenarios/Builder";

export const metadata = { title: "New scenario" };

export default async function NewScenario({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { broker, db } = await requireBroker();
  if (!features(broker).scenario) redirect("/dashboard");
  const { lead: leadId } = await searchParams;
  const lead = leadId ? await db.lead.findFirst({ where: { id: leadId } }) : null;
  const states = licensedStates(broker);
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/scenarios" className="text-sm text-muted hover:text-ink">← Scenarios</Link>
      <PageHeader title="New scenario" subtitle={lead ? `For ${lead.name}, prefilled from their Instant Check.` : "Two or three loan options side by side. The investor gets a private link that works great on a phone."} />
      <ScenarioBuilder ctx={engineContext(broker)} initial={lead ? initialFromLead(lead) : blankInitial(states.length === 1 ? states[0] : undefined)} feesDefaultCents={DEFAULT_LENDER_FEES_CENTS} />
    </div>
  );
}
