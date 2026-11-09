import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { brokerStats } from "@/lib/stats";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { Card, CardHeader, LinkButton, PageHeader, Stat, Td, Th, Badge } from "@/components/ui";
import { ImpersonateButton } from "./ImpersonateButton";
import { providerModes } from "@/lib/env";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Agency overview" };

export default async function AdminHome() {
  const { agency } = await requireAdmin();
  const brokers = await prisma.broker.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: "asc" } });
  const stats = await brokerStats(brokers.map((b) => b.id));
  type NumKey = Exclude<keyof NonNullable<ReturnType<typeof stats.get>>, "lastActivity">;
  const total = (k: NumKey) => brokers.reduce((s, b) => s + (stats.get(b.id)?.[k] ?? 0), 0);
  const modes = providerModes();

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
          <table className="w-full min-w-[960px]">
            <thead className="bg-paper"><tr><Th>Broker</Th><Th className="text-right">Leads</Th><Th className="text-right">Scenarios</Th><Th className="text-right">Opens</Th><Th className="text-right">Snapshots / scans</Th><Th className="text-right">Money List</Th><Th>Last activity</Th><Th /></tr></thead>
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
                    <Td>{s.lastActivity ? (Date.now() - s.lastActivity.getTime() > 14 * 86400_000 ? <Badge tone="warn">{relativeTime(s.lastActivity)}</Badge> : <span className="text-muted">{relativeTime(s.lastActivity)}</span>) : <Badge tone="bad">Never</Badge>}</Td>
                    <Td className="text-right"><ImpersonateButton brokerId={b.id} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Integrations" subtitle="Platform-wide API keys (set in your hosting environment). Mock modes keep every flow working without keys." />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries({ Email: modes.email, "AI drafts & extraction": modes.ai, "Rent estimates": modes.rent, Transcription: modes.transcription }).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">{k}</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium"><span className={`h-2 w-2 rounded-full ${v.includes("ock") ? "bg-warn" : "bg-good"}`} />{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
