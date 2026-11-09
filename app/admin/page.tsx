import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { brokerStats } from "@/lib/stats";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { Card, CardHeader, LinkButton, PageHeader, Stat, Td, Th, Badge } from "@/components/ui";
import { ImpersonateButton } from "./ImpersonateButton";

export const metadata = { title: "Agency overview" };

export default async function AdminHome() {
  const { agency } = await requireAdmin();
  const brokers = await prisma.broker.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: "asc" } });
  const stats = await brokerStats(brokers.map((b) => b.id));
  const total = (k: keyof NonNullable<ReturnType<typeof stats.get>>) => brokers.reduce((s, b) => s + (stats.get(b.id)?.[k] ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Agency overview" subtitle={`${brokers.length} brokers on the platform. Numbers update live.`} actions={<LinkButton href="/admin/brokers/new">Add broker</LinkButton>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Leads (30 days)" value={total("leads30")} hint={`${total("leads")} all time`} />
        <Stat label="Scenarios" value={total("scenarios")} />
        <Stat label="Scenario opens" value={total("opens")} />
        <Stat label="QR scans" value={total("scans")} hint={`${total("snapshots")} snapshots`} />
        <Stat label="Money List opps" value={total("opportunities")} hint="open, not yet contacted" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Brokers" subtitle="Activity across every broker tenant" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-paper"><tr><Th>Broker</Th><Th className="text-right">Leads</Th><Th className="text-right">Scenarios</Th><Th className="text-right">Opens</Th><Th className="text-right">Snapshots / scans</Th><Th className="text-right">Money List</Th><Th /></tr></thead>
            <tbody className="divide-y divide-line">
              {brokers.map((b) => {
                const s = stats.get(b.id)!;
                return (
                  <tr key={b.id} className="hover:bg-paper/60">
                    <Td>
                      <Link href={`/admin/brokers/${b.id}`} className="flex items-center gap-3">
                        <BrokerAvatar broker={b} size={34} />
                        <span>
                          <span className="block font-medium text-ink">{b.companyName}</span>
                          <span className="block text-xs text-muted">{b.name} · NMLS #{b.nmlsId} {!b.active && <Badge tone="bad">Inactive</Badge>}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="num text-right">{s.leads} <span className="text-xs text-muted">({s.leads30} / 30d)</span></Td>
                    <Td className="num text-right">{s.scenarios}</Td>
                    <Td className="num text-right">{s.opens}</Td>
                    <Td className="num text-right">{s.snapshots} / {s.scans}</Td>
                    <Td className="num text-right">{s.opportunities}</Td>
                    <Td className="text-right"><ImpersonateButton brokerId={b.id} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
