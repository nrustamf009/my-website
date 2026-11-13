import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, features, parseJson } from "@/lib/broker";
import { computeOptions, publicState } from "@/lib/scenarios";
import { env } from "@/lib/env";
import { dateTime, dscr, duration, points, rate, relativeTime, shortDate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { Badge, Card, CardHeader, LinkButton, Notice, cx } from "@/components/ui";
import { ManageButtons, SharePanel } from "@/components/scenarios/Actions";

export const metadata = { title: "Scenario" };

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { broker, db } = await requireBroker();
  if (!features(broker).scenario) redirect("/dashboard");
  const { id } = await params;
  const s = await db.scenario.findFirst({ where: { id }, include: { options: true, views: { orderBy: { startedAt: "desc" } } } });
  if (!s) notFound();
  const rows = computeOptions(s, engineContext(broker).grid);
  const st = publicState(s);
  const url = `${env.appUrl}/b/${broker.slug}/s/${s.token}`;
  const events = await db.event.findMany({ where: { entityType: "Scenario", entityId: s.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const expanded = events.filter((e) => e.type === "scenario.option_expanded").map((e) => parseJson<{ optionId?: string }>(e.meta, {}).optionId);
  const picked = s.options.find((o) => o.id === s.interestedOptionId);
  const totalSeconds = s.views.reduce((n, v) => n + v.activeSeconds, 0);
  const EV: Record<string, string> = { "scenario.created": "Created", "scenario.shared": "Shared", "scenario.opened": "Opened for the first time", "scenario.reopened": "Reopened", "scenario.option_expanded": "Looked at the details of", "scenario.interest": "Picked", "scenario.revoked": "Revoked" };

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/scenarios" className="text-sm text-muted hover:text-ink">← Scenarios</Link>
      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl tracking-tight text-ink">{s.investorName}</h1>
            <Badge tone={st === "LIVE" ? "good" : st === "DRAFT" ? "neutral" : st === "EXPIRED" ? "warn" : "bad"}>{st === "LIVE" ? `Shared · until ${shortDate(s.expiresAt)}` : st === "EXPIRED" ? "Expired" : st === "REVOKED" ? "Revoked" : "Draft"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{t.mode[s.mode as "PURCHASE"]} · {s.propertyAddress} · {usd(s.valueCents)} · rent {usd(s.rentCents)}/mo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/dashboard/scenarios/${s.id}/edit`} variant="secondary">Edit</LinkButton>
          <LinkButton href={`/api/public/${broker.slug}/s/${s.token}/pdf?staff=1`} prefetch={false} target="_blank" variant="secondary">PDF</LinkButton>
        </div>
      </div>
      {picked && (
        <div className="mb-5"><Notice tone="good"><b>{s.investorName.split(" ")[0]} picked Option {picked.label}</b> {s.interestedAt ? relativeTime(s.interestedAt) : ""}.{s.interestQuestion ? <> They asked: &ldquo;{s.interestQuestion}&rdquo;</> : null}</Notice></div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Options" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-y border-line text-left text-xs uppercase tracking-wider text-muted"><th className="px-4 py-2" />{rows.map((r) => <th key={r.option.id} className="px-4 py-2 text-right">Option {r.option.label}{r.option.recommended ? " ★" : ""}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {([
                  ["Product", (r) => t.productShort[r.input.product]],
                  ["Loan", (r) => usd(r.input.loanAmountCents)],
                  ["Rate", (r) => rate(r.input.rateMilli)],
                  ["Points", (r) => (r.input.pointsRatio === 0 ? "—" : r.input.pointsRatio > 0 ? points(r.input.pointsRatio) : `${points(-r.input.pointsRatio)} credit`)],
                  ["Prepay", (r) => t.prepay[r.input.prepay]],
                  ["Payment", (r) => `${usd(r.result.pitiaCents)}/mo`],
                  ["DSCR", (r) => dscr(r.result.dscrRatio)],
                  [s.currentBalanceCents != null ? "Cash to investor / to close" : "Cash to close", (r) => (r.result.cashToBorrowerCents ? `+${usd(r.result.cashToBorrowerCents)}` : usd(r.result.cashToCloseCents))],
                  ["5-year cost", (r) => usd(r.result.fiveYearCostCents)],
                  ["Detail views", (r) => String(expanded.filter((x) => x === r.option.id).length)],
                ] as [string, (r: (typeof rows)[number]) => string][]).map(([k, fn]) => (
                  <tr key={k}><td className="px-4 py-2 text-muted">{k}</td>{rows.map((r) => <td key={r.option.id} className={cx("num px-4 py-2 text-right", r.option.id === s.interestedOptionId && "bg-accent-soft font-semibold")}>{fn(r)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Share" subtitle="A private link that works on any phone. No login for the investor." />
            <div className="px-5 pb-5"><SharePanel id={s.id} url={url} hasEmail={!!s.investorEmail} shared={s.status === "SHARED"} live={st !== "REVOKED"} /></div>
          </Card>
          <Card>
            <CardHeader title="Engagement" subtitle={s.views.length ? `${s.views.length} visit${s.views.length === 1 ? "" : "s"} · ${duration(totalSeconds)} on page` : "Not opened yet"} />
            <ul className="space-y-1.5 px-5 pb-4 text-sm" data-testid="scenario-views">
              {s.views.slice(0, 8).map((v) => <li key={v.id} className="flex justify-between gap-2"><span className="text-ink-2">{v.device === "mobile" ? "📱 Phone" : "💻 Computer"}</span><span className="text-muted">{dateTime(v.startedAt)} · {duration(v.activeSeconds)}</span></li>)}
            </ul>
            <div className="border-t border-line px-5 py-3"><ManageButtons id={s.id} revoked={!!s.revokedAt} /></div>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <ol className="space-y-1.5 px-5 pb-5 text-sm">
              {events.map((e) => {
                const optId = parseJson<{ optionId?: string }>(e.meta, {}).optionId;
                const label = optId ? s.options.find((o) => o.id === optId)?.label : null;
                return <li key={e.id} className="flex justify-between gap-2"><span className="text-ink-2">{EV[e.type] ?? e.type}{label ? ` Option ${label}` : ""}</span><span className="shrink-0 text-xs text-muted">{dateTime(e.createdAt)}</span></li>;
              })}
            </ol>
          </Card>
        </div>
      </div>
      {s.note && <p className="mt-5 max-w-2xl text-sm text-muted">Note to investor: {s.note}</p>}
    </div>
  );
}
