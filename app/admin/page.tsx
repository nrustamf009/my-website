import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma, forBrokers } from "@/lib/db";
import { agencyBrokerStats, periods, roiStats } from "@/lib/stats";
import { providerModes } from "@/lib/env";
import { daysSince, relativeTime } from "@/lib/format";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { Badge, Card, CardHeader, LinkButton, Notice, PageHeader, Stat, Td, Th } from "@/components/ui";
import { ImpersonateButton } from "./ImpersonateButton";

export const metadata = { title: "Agency overview" };

const STATUS_TONE = { TRIAL: "warn", ACTIVE: "good", SUSPENDED: "bad" } as const;

export default async function AdminHome() {
  const { agency } = await requireAdmin();
  const brokers = await prisma.broker.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: "asc" } });
  const stats = await agencyBrokerStats(brokers);
  const p = periods();
  const month = brokers.length ? await roiStats(forBrokers(brokers.map((b) => b.id)), p.thisMonth) : null;
  const modes = providerModes();
  const atRisk = brokers.filter((b) => {
    const s = stats.get(b.id);
    return b.status !== "SUSPENDED" && (!s?.lastActivity || daysSince(s.lastActivity) > 14);
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Agency overview" subtitle={`${brokers.length} broker clients. Last 30 days across all of them.`} actions={<LinkButton href="/admin/brokers/new">Add broker</LinkButton>} />
      {month && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Leads" value={month.leads} hint={Object.entries(month.leadsBySource).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ") || "—"} />
          <Stat label="Scenario opens" value={month.scenarioOpens} hint={`${month.scenarioInterest} option picks`} />
          <Stat label="QR scans" value={month.snapshotScans} />
          <Stat label="Past clients contacted" value={month.moneyListContacted} hint={`${month.moneyListWon} marked won`} />
          <Stat label="Instant checks" value={month.checks} />
        </div>
      )}
      {atRisk.length > 0 && (
        <div className="mt-4">
          <Notice tone="warn"><strong>Churn risk:</strong> {atRisk.map((b) => b.companyName).join(", ")} had no activity in 14+ days. A quick check-in call usually fixes adoption.</Notice>
        </div>
      )}
      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Brokers" subtitle="30-day activity per client: what you show them in the monthly review" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-paper"><tr><Th>Broker</Th><Th>Status</Th><Th className="text-right">Leads</Th><Th className="text-right">Opens</Th><Th className="text-right">Scans</Th><Th className="text-right">Contacted</Th><Th className="text-right">Money List</Th><Th>Last activity</Th><Th /></tr></thead>
            <tbody className="divide-y divide-line">
              {brokers.map((b) => {
                const s = stats.get(b.id)!;
                return (
                  <tr key={b.id} className="hover:bg-paper/60">
                    <Td><Link href={`/admin/brokers/${b.id}`} className="flex items-center gap-3"><BrokerAvatar broker={b} size={34} /><span><span className="block font-medium text-ink">{b.companyName}</span><span className="block text-xs text-muted">NMLS #{b.companyNmlsId}</span></span></Link></Td>
                    <Td><Badge tone={STATUS_TONE[b.status as keyof typeof STATUS_TONE] ?? "neutral"}>{b.status.toLowerCase()}</Badge></Td>
                    <Td className="num text-right">{s.leads30}</Td>
                    <Td className="num text-right">{s.opens30}</Td>
                    <Td className="num text-right">{s.scans30}</Td>
                    <Td className="num text-right">{s.contacted30}</Td>
                    <Td className="num text-right">{s.opportunities}</Td>
                    <Td>{s.lastActivity ? <span className={daysSince(s.lastActivity) > 14 ? "text-warn" : "text-muted"}>{relativeTime(s.lastActivity)}</span> : <Badge tone="bad">Never</Badge>}</Td>
                    <Td className="text-right"><ImpersonateButton brokerId={b.id} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Integrations" subtitle="Platform API keys. Mock modes keep every flow working without keys." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {Object.entries({ Email: modes.email, "AI drafts": modes.ai, "Rent & taxes": modes.rent, "Bot protection": modes.bot }).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium"><span className={`h-2 w-2 rounded-full ${v.includes("ock") ? "bg-warn" : "bg-good"}`} />{v}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Compliance notes for the agency" subtitle="Not legal advice" />
          <ul className="space-y-2 p-5 text-sm text-ink-2">
            <li><strong>RESPA §8:</strong> Listing Snapshots are designed as the broker&apos;s financing flyer with a modest realtor block. Free marketing for referral partners can be a “thing of value”. Have counsel review the co-marketing practice (pro-rata cost sharing is common).</li>
            <li><strong>TCPA:</strong> every public form stores express-written-consent text, version, time, IP and user agent. Texting from a CRM should honor STOP.</li>
            <li><strong>Prepayment penalties:</strong> some states restrict them depending on vesting (individual vs LLC). Brokers confirm availability per state.</li>
            <li>Full checklist: <code>docs/COMPLIANCE.md</code>.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
