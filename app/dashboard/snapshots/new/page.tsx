import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SnapshotForm } from "@/components/dashboard/SnapshotForm";

export const metadata = { title: "New listing snapshot" };

export default async function NewSnapshot() {
  const { broker } = await requireBroker();
  const realtors = await prisma.realtor.findMany({ where: { brokerId: broker.id }, orderBy: { name: "asc" } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New listing snapshot" subtitle="A one-page co-branded PDF a realtor can hand out at showings. The QR code opens a property page where investors can get pre-qualified." />
      <SnapshotForm realtors={realtors} defaultRate={broker.defaultRate} />
    </div>
  );
}
