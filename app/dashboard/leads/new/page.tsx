import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { ManualLeadForm } from "@/components/leads/Controls";

export const metadata = { title: "Add lead" };

export default async function NewLead() {
  await requireBroker();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/leads" className="text-sm text-muted hover:text-ink">← Leads</Link>
      <PageHeader title="Add a lead" subtitle="For investors who reached you by phone, email or referral." />
      <Card className="p-5"><ManualLeadForm /></Card>
    </div>
  );
}
