import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { features, moneyListRules, parseJson } from "@/lib/broker";
import { buildMoneyList } from "@/lib/moneylist/list";
import { periods, roiStats, type RoiStats } from "@/lib/stats";
import { dscr, relativeTime, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import type { Verdict } from "@/lib/dscr";
import { Badge, Card, CardHeader, LinkButton, Notice, PageHeader, cx } from "@/components/ui";
import { describeOpportunity, triggerShort } from "@/lib/moneylist/describe";
import { TRIGGER_TONE } from "@/components/moneylist/labels";

export const metadata = { title: "Overview" };

const SOURCE: Record<string, string> = { WIDGET: "Instant Check", SNAPSHOT: "Listing QR", SCENARIO: "Scenario", NOTES: "Notes", MANUAL: "Manual" };
const VTONE: Record<Verdict, "good" | "warn" | "bad"> = { STRONG: "good", BORDERLINE: "warn", NEEDS_ADJUSTMENT: "warn", NOT_ELIGIBLE: "bad" };

function Delta({ now, prev }: { now: number; prev: number }) {
  if (now === prev) return <span className="text-xs text-muted">same as last week</span>;
  const up = now > prev;
  return <span className={cx("text-xs font-medium", up ? "text-good" : "text-bad")}>{up ? "▲" : "▼"} {Math.abs(now - prev)} vs last week</span>;
}

function RoiTile({ label, k, w, p }: { label: string; k: keyof RoiStats; w: RoiStats; p: RoiStats }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="num mt-1 font-display text-3xl">{w[k] as number}</div>
      <Delta now={w[k] as number} prev={p[k] as number} />
    </div>
  );
}

export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { broker, db, user } = await requireBroker();
  const { welcome } = await searchParams;
  const f = features(broker);
  const p = periods();
  const since48h = new Date(Date.now() - 48 * 3_600_000);
  const [week, prev, newLeads, hot, ml] = await Promise.all([
    roiStats(db, p.thisWeek),
    roiStats(db, p.lastWeek, p.thisWeek),
    db.lead.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 5, include: { realtor: true } }),
    db.scenario.findMany({
      where: { status: "SHARED", OR: [{ views: { some: { startedAt: { gte: since48h } } } }, { interestedAt: { gte: since48h } }] },
      include: { views: { orderBy: { startedAt: "desc" }, take: 1 }, options: true },
      take: 5,
    }),
    f.moneyList ? buildMoneyList(db, broker) : Promise.resolve(null),
  ]);
  const first = (user?.name ?? broker.companyName).split(" ")[0];
  const todo = newLeads.length + hot.length + Math.min(3, ml?.rows.length ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hi ${first}`}
        subtitle={todo ? `${todo} thing${todo === 1 ? "" : "s"} worth your attention today.` : "You're all caught up. Share your Instant Check to bring in new investors."}
        actions={
          <>
            {f.scenario && <LinkButton href="/dashboard/scenarios/new" variant="accent">New scenario</LinkButton>}
            {f.snapshot && <LinkButton href="/dashboard/snapshots/new" variant="secondary">New snapshot</LinkButton>}
          </>
        }
      />
      {welcome && <div className="mb-6"><Notice tone="good">Setup complete. Share your Instant Check link (Share &amp; embed) and import your closed loans to fill the Money List.</Notice></div>}

      <section aria-label="This week">
        <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-xl">This week</h2><span className="text-xs text-muted">Results you can show your agency</span></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <RoiTile label="New leads" k="leads" w={week} p={prev} />
          <RoiTile label="Instant checks" k="checks" w={week} p={prev} />
          <RoiTile label="Scenario opens" k="scenarioOpens" w={week} p={prev} />
          <RoiTile label="QR scans" k="snapshotScans" w={week} p={prev} />
          <RoiTile label="Past clients contacted" k="moneyListContacted" w={week} p={prev} />
        </div>
        {week.leads > 0 && <p className="mt-2 text-xs text-muted">Leads by source: {Object.entries(week.leadsBySource).map(([k, v]) => `${SOURCE[k] ?? k} ${v}`).join(" · ")}</p>}
      </section>

      <h2 className="mb-3 mt-8 font-display text-xl">Today</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Call new leads" subtitle="They asked to be contacted" action={<Link href="/dashboard/leads" className="text-sm text-accent">All →</Link>} />
          <ul className="divide-y divide-line">
            {newLeads.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No new leads.</li>}
            {newLeads.map((l) => {
              const out = parseJson<{ dscrRatio?: number | null; verdict?: Verdict }>(l.engineOutput, {});
              const tel = l.phone?.replace(/[^\d+]/g, "");
              return (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/dashboard/leads/${l.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <div className="truncate text-xs text-muted">{SOURCE[l.source]}{l.realtor ? ` · via ${l.realtor.name}` : ""} · {relativeTime(l.createdAt)}</div>
                    {out.verdict && <Badge tone={VTONE[out.verdict]} className="mt-1">DSCR {dscr(out.dscrRatio)} · {t.verdict[out.verdict]}</Badge>}
                  </Link>
                  {tel && <a href={`tel:${tel}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent" aria-label={`Call ${l.name}`}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" /></svg></a>}
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Hot scenarios" subtitle="Opened in 48h or an option picked" action={<Link href="/dashboard/scenarios" className="text-sm text-accent">All →</Link>} />
          <ul className="divide-y divide-line">
            {hot.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No recent activity.</li>}
            {hot.map((s) => {
              const picked = s.options.find((o) => o.id === s.interestedOptionId);
              return (
                <li key={s.id}>
                  <Link href={`/dashboard/scenarios/${s.id}`} className="block px-5 py-3 hover:bg-paper/60">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{s.investorName}</span>{picked ? <Badge tone="good">Picked {picked.label}</Badge> : <Badge tone="accent">Viewing</Badge>}</div>
                    <div className="truncate text-xs text-muted">{s.propertyAddress.split(",")[0]}{s.views[0] ? ` · opened ${relativeTime(s.views[0].startedAt)}` : ""}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Money List" subtitle="Past clients worth a call" action={<Link href="/dashboard/money-list" className="text-sm text-accent">All →</Link>} />
          <ul className="divide-y divide-line">
            {!ml || ml.rows.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted">{ml?.total ? "No opportunities right now." : <>Import your closed loans to find refi opportunities. <Link href="/dashboard/money-list/import" className="text-accent underline">Import</Link></>}</li>
            ) : (
              ml.rows.slice(0, 3).map(({ loan, evaluation }) => (
                <li key={loan.id}>
                  <Link href={`/dashboard/money-list/${loan.id}`} className="block px-5 py-3 hover:bg-paper/60">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{loan.borrowerName}</span><Badge tone={TRIGGER_TONE[evaluation.triggers[0]!.kind]}>{triggerShort(evaluation.triggers[0]!)}</Badge></div>
                    <div className="truncate text-xs text-muted">{(() => { const op = describeOpportunity(evaluation, moneyListRules(broker).horizonMonths); return op.kind === "NONE" ? `${op.benefitLabel} · ${loan.propertyAddress}` : `${op.benefitLabel} ${op.benefitHint}`; })()}</div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
