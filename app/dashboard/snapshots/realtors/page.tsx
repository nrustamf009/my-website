import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { pct } from "@/lib/format";

export const metadata = { title: "Realtor stats" };

export default async function RealtorStats() {
  const { broker } = await requireBroker();
  const realtors = await prisma.realtor.findMany({
    where: { brokerId: broker.id },
    include: { snapshots: { include: { _count: { select: { scans: true } } } }, _count: { select: { leads: true } } },
  });
  const rows = realtors
    .map((r) => ({ r, snaps: r.snapshots.length, scans: r.snapshots.reduce((s, x) => s + x._count.scans, 0), leads: r._count.leads }))
    .sort((a, b) => b.leads - a.leads || b.scans - a.scans);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Realtor partners" subtitle="Which realtors send you investor traffic. Use this to decide who gets your time at the next open house." />
      {rows.length === 0 ? (
        <EmptyState title="No realtors yet" body="Realtors are added when you create a listing snapshot." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-paper"><tr><Th>Realtor</Th><Th className="text-right">Snapshots</Th><Th className="text-right">QR scans</Th><Th className="text-right">Leads</Th><Th className="text-right">Scan → lead</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ r, snaps, scans, leads }) => (
                <tr key={r.id}>
                  <Td><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-muted">{r.brokerage}{r.email ? ` · ${r.email}` : ""}</div></Td>
                  <Td className="num text-right">{snaps}</Td>
                  <Td className="num text-right">{scans}</Td>
                  <Td className="num text-right font-semibold">{leads}</Td>
                  <Td className="num text-right text-muted">{scans ? pct(leads / scans, 0) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
