import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { brokerStats } from "@/lib/stats";
import { env, providerModes } from "@/lib/env";
import { relativeTime, usd } from "@/lib/format";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Overview" };

const SOURCE_LABEL: Record<string, string> = { CHECK: "Instant Check", LISTING: "Listing QR", SCENARIO: "Scenario" };

export default async function Overview() {
  const { broker } = await requireBroker();
  const stats = (await brokerStats([broker.id])).get(broker.id)!;
  const [leads, recentViews] = await Promise.all([
    prisma.lead.findMany({ where: { brokerId: broker.id }, orderBy: { createdAt: "desc" }, take: 6, include: { realtor: true } }),
    prisma.scenarioView.findMany({ where: { scenario: { brokerId: broker.id } }, orderBy: { startedAt: "desc" }, take: 6, include: { scenario: true } }),
  ]);
  const modes = providerModes();
  const firstName = broker.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        subtitle="Here's what investors have been doing with your tools."
        actions={<><LinkButton href="/dashboard/scenarios/new" variant="accent">New scenario</LinkButton><LinkButton href="/dashboard/snapshots/new" variant="secondary">New snapshot</LinkButton></>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leads (30 days)" value={stats.leads30} hint={`${stats.leads} all time`} />
        <Stat label="Scenario opens" value={stats.opens} hint={`${stats.scenarios} scenarios`} />
        <Stat label="QR scans" value={stats.scans} hint={`${stats.snapshots} snapshots`} />
        <Stat label="Money List" value={stats.opportunities} hint={`opportunities in ${stats.closedLoans} loans`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Latest leads" action={<Link href="/dashboard/leads" className="text-sm text-accent">All leads →</Link>} />
          <ul className="divide-y divide-line">
            {leads.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No leads yet. Share your Instant Check link to start.</li>}
            {leads.map((l) => (
              <li key={l.id}>
                <Link href={`/dashboard/leads/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper/60">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <div className="truncate text-xs text-muted">{l.propertyAddress ?? "—"}{l.purchasePrice ? ` · ${usd(l.purchasePrice)}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <Badge tone={l.source === "LISTING" ? "accent" : "neutral"}>{SOURCE_LABEL[l.source] ?? l.source}{l.realtor ? ` · ${l.realtor.name.split(" ")[0]}` : ""}</Badge>
                    <div className="mt-1 text-xs text-muted">{relativeTime(l.createdAt)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Scenario activity" action={<Link href="/dashboard/scenarios" className="text-sm text-accent">All scenarios →</Link>} />
          <ul className="divide-y divide-line">
            {recentViews.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No opens yet.</li>}
            {recentViews.map((v) => (
              <li key={v.id}>
                <Link href={`/dashboard/scenarios/${v.scenarioId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper/60">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-deep">{v.device === "mobile" ? "📱" : "💻"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm"><strong className="font-medium">{v.scenario.investorName}</strong> viewed {v.scenario.propertyAddress.split(",")[0]}</div>
                    <div className="text-xs text-muted">{relativeTime(v.startedAt)} · {Math.max(1, Math.round(v.activeSeconds / 60))} min on page</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Your links" subtitle="Share these anywhere. Everything is branded for you." />
        <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          <div><div className="text-xs text-muted">Instant Check page</div><a className="break-all font-medium text-accent" href={`/b/${broker.slug}/check`} target="_blank">{env.appUrl}/b/{broker.slug}/check</a></div>
          <div><div className="text-xs text-muted">Integrations status</div><div className="mt-0.5 flex flex-wrap gap-1.5">{Object.entries(modes).map(([k, v]) => <Badge key={k} tone={v.includes("ock") ? "warn" : "good"}>{k}: {v}</Badge>)}</div></div>
        </div>
      </Card>
    </div>
  );
}
