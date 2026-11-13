import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features } from "@/lib/broker";
import { PageHeader } from "@/components/ui";
import { SnapshotForm } from "@/components/snapshots/Forms";

export const metadata = { title: "New snapshot" };

export default async function NewSnapshotPage({ searchParams }: { searchParams: Promise<{ realtor?: string }> }) {
  const { broker, db } = await requireBroker();
  if (!features(broker).snapshot) redirect("/dashboard");
  const realtors = await db.realtor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, brokerage: true } });
  const { realtor } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/snapshots" className="text-sm text-muted hover:text-ink">← Listing Snapshots</Link>
      <PageHeader title="New listing snapshot" subtitle="Rent, taxes and insurance fill in automatically when you leave them blank. You can always type the real numbers." />
      <SnapshotForm realtors={realtors} defaultRealtorId={realtor} />
    </div>
  );
}
