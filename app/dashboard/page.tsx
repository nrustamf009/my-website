import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { brokerStats } from "@/lib/stats";
import { env } from "@/lib/env";
import { parseJson } from "@/lib/broker";
import { evaluateAll, settingsFromBroker, VERDICT_LABEL, type Verdict } from "@/lib/dscr";
import { ratio, relativeTime, usd } from "@/lib/format";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Stat } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";

export const metadata = { title: "Overview" };

const SOURCE_LABEL: Record<string, string> = { CHECK: "Instant Check", LISTING: "Listing QR", SCENARIO: "Scenario" };
const VERDICT_TONE = { LIKELY: "good", BORDERLINE: "warn", UNLIKELY: "bad" } as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Overview() {
  const { broker } = await requireBroker();
  const since48h = new Date(Date.now() - 48 * 3600_000);
  const [stats, newLeads, hotScenarios, openLoans] = await Promise.all([
    brokerStats([broker.id]).then((m) => m.get(broker.id)!),
    prisma.lead.findMany({ where: { brokerId: broker.id, status: "NEW" }, orderBy: { createdAt: "desc" }, take: 4, include: { realtor: true } }),
    prisma.scenario.findMany({
      where: { brokerId: broker.id, status: { not: "ARCHIVED" }, OR: [{ views: { some: { startedAt: { gte: since48h } } } }, { interestedAt: { gte: new Date(Date.now() - 7 * 86400_000) } }] },
      include: { views: { orderBy: { startedAt: "desc" }, take: 1 }, options: true },
      take: 4,
    }),
    prisma.closedLoan.findMany({ where: { brokerId: broker.id, contactedAt: null } }),
  ]);
  const topMoney = evaluateAll(openLoans, settingsFromBroker(broker)).slice(0, 3);
  const firstName = broker.name.split(" ")[0];
  const todo = newLeads.length + hotScenarios.length + topMoney.length;
  const checkUrl = `${env.appUrl}/b/${broker.slug}/check`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={todo ? `${todo} thing${todo === 1 ? "" : "s"} worth your attention today.` : "You're all caught up. Share your Instant Check to bring in new investors."}
        actions={<><LinkButton href="/dashboard/scenarios/new" variant="accent">New scenario</LinkButton><LinkButton href="/dashboard/snapshots/new" variant="secondary">New snapshot</LinkButton></>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leads (30 days)" value={stats.leads30} hint={`${stats.leads} all time`} />
        <Stat label="Scenario opens" value={stats.opens} hint={`${stats.scenarios} scenarios`} />
        <Stat label="QR scans" value={stats.scans} hint={`${stats.snapshots} snapshots`} />
        <Stat label="Money List" value={stats.opportunities} hint={`opportunities in ${stats.closedLoans} loans`} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-2xl">Today</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Call new leads" subtitle="They asked to be contacted" action={<Link href="/dashboard/leads" className="text-sm text-accent">All →</Link>} />
          <ul className="divide-y divide-line">
            {newLeads.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No new leads. Nice work.</li>}
            {newLeads.map((l) => {
              const r = parseJson<{ dscr: number | null; verdict: Verdict } | null>(l.resultJson, null);
              const tel = l.phone?.replace(/[^\d+]/g, "");
              return (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/dashboard/leads/${l.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <div className="truncate text-xs text-muted">{SOURCE_LABEL[l.source]}{l.realtor ? ` · via ${l.realtor.name}` : ""} · {relativeTime(l.createdAt)}</div>
                    {r && <Badge tone={VERDICT_TONE[r.verdict]} className="mt-1">DSCR {ratio(r.dscr)} · {VERDICT_LABEL[r.verdict]}</Badge>}
                  </Link>
                  {tel && <a href={`tel:${tel}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent" aria-label={`Call ${l.name}`}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" /></svg></a>}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Hot scenarios" subtitle="Opened in 48h or picked an option" action={<Link href="/dashboard/scenarios" className="text-sm text-accent">All →</Link>} />
          <ul className="divide-y divide-line">
            {hotScenarios.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No recent activity.</li>}
            {hotScenarios.map((s) => {
              const picked = s.options.find((o) => o.id === s.interestedOptionId);
              return (
                <li key={s.id}>
                  <Link href={`/dashboard/scenarios/${s.id}`} className="block px-5 py-3 hover:bg-paper/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{s.investorName}</span>
                      {picked ? <Badge tone="good">Picked {picked.label}</Badge> : <Badge tone="accent">Viewing</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted">{s.propertyAddress.split(",")[0]}{s.views[0] ? ` · opened ${relativeTime(s.views[0].startedAt)}` : ""}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Money List" subtitle="Past clients to reach out to" action={<Link href="/dashboard/money-list" className="text-sm text-accent">All →</Link>} />
          <ul className="divide-y divide-line">
            {topMoney.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">{openLoans.length ? "No opportunities right now." : "Import your closed loans to start."}</li>}
            {topMoney.map(({ loan, opp }) => (
              <li key={loan.id}>
                <Link href="/dashboard/money-list" className="block px-5 py-3 hover:bg-paper/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{loan.borrowerName}</span>
                    <Badge>{opp.reasons[0]!.label}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted">{opp.benefit}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Your Instant Check page</div>
            <p className="text-sm text-muted">Put it in your Instagram bio, email signature and listing flyers. Every lead lands here.</p>
            <a className="mt-1 block truncate text-sm font-medium text-accent" href={checkUrl} target="_blank">{checkUrl.replace(/^https?:\/\//, "")}</a>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={checkUrl} label="Copy link" />
            <LinkButton href="/dashboard/settings#embed" variant="secondary" size="sm">Embed on my website</LinkButton>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Recent leads" action={<Link href="/dashboard/leads" className="text-sm text-accent">All leads →</Link>} />
        <RecentLeads brokerId={broker.id} />
      </Card>
    </div>
  );
}

async function RecentLeads({ brokerId }: { brokerId: string }) {
  const leads = await prisma.lead.findMany({ where: { brokerId }, orderBy: { createdAt: "desc" }, take: 5, include: { realtor: true } });
  return (
    <ul className="divide-y divide-line">
      {leads.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No leads yet. Share your Instant Check link to start.</li>}
      {leads.map((l) => (
        <li key={l.id}>
          <Link href={`/dashboard/leads/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper/60">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{l.name}</div>
              <div className="truncate text-xs text-muted">{l.propertyAddress ?? "—"}{l.purchasePrice ? ` · ${usd(l.purchasePrice)}` : ""}</div>
            </div>
            <div className="shrink-0 text-right">
              <Badge tone={l.source === "LISTING" ? "accent" : "neutral"}>{SOURCE_LABEL[l.source] ?? l.source}</Badge>
              <div className="mt-1 text-xs text-muted">{relativeTime(l.createdAt)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
