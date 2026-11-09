import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { listingSnapshotNumbers } from "@/lib/dscr";
import { ratio, relativeTime, usd } from "@/lib/format";
import { Card, EmptyState, LinkButton, PageHeader, Td, Th } from "@/components/ui";

export const metadata = { title: "Listing snapshots" };

export default async function Snapshots() {
  const { broker } = await requireBroker();
  const snaps = await prisma.snapshot.findMany({
    where: { brokerId: broker.id },
    orderBy: { createdAt: "desc" },
    include: { realtor: true, _count: { select: { scans: true, leads: true } } },
  });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Listing snapshots"
        subtitle="Co-branded investor PDFs for your realtor partners. Every QR scan and lead is tracked."
        actions={<><LinkButton href="/dashboard/snapshots/realtors" variant="secondary">Realtor stats</LinkButton><LinkButton href="/dashboard/snapshots/new" variant="accent">New snapshot</LinkButton></>}
      />
      {snaps.length === 0 ? (
        <EmptyState title="No snapshots yet" body="Create one for a listing your realtor partner is marketing to investors." action={<LinkButton href="/dashboard/snapshots/new">Create snapshot</LinkButton>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-paper"><tr><Th>Property</Th><Th>Realtor</Th><Th className="text-right">DSCR @ 25%</Th><Th className="text-right">Scans</Th><Th className="text-right">Leads</Th><Th className="text-right">Created</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {snaps.map((s) => {
                const n = listingSnapshotNumbers({ price: s.price, monthlyRent: s.monthlyRent, ratePct: s.ratePct, escrow: s });
                return (
                  <tr key={s.id} className="hover:bg-paper/60">
                    <Td><Link href={`/dashboard/snapshots/${s.id}`} className="font-medium text-ink hover:text-accent">{s.address}</Link><div className="text-xs text-muted">{usd(s.price)} · rent {usd(s.monthlyRent)}</div></Td>
                    <Td>{s.realtor.name}<div className="text-xs text-muted">{s.realtor.brokerage}</div></Td>
                    <Td className="num text-right font-medium">{ratio(n.twentyFive.dscr)}</Td>
                    <Td className="num text-right">{s._count.scans}</Td>
                    <Td className="num text-right">{s._count.leads}</Td>
                    <Td className="text-right text-muted">{relativeTime(s.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
