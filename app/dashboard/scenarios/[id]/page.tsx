import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { computeScenario, PURPOSE_LABEL } from "@/lib/scenarios";
import { COST_HORIZON_YEARS, PREPAY_LABEL, type PrepayType } from "@/lib/dscr";
import { dateTime, duration, pct, rate, ratio, relativeTime, usd } from "@/lib/format";
import { archiveScenario, duplicateScenario } from "@/lib/actions/scenarios";
import { Badge, Button, Card, CardHeader, LinkButton, Notice, PageHeader, Stat, Td, Th, cx } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { EmailInvestorButton } from "@/components/scenarios/EmailInvestorButton";

export default async function ScenarioDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ shared?: string }> }) {
  const { broker } = await requireBroker();
  const { id } = await params;
  const { shared } = await searchParams;
  const s = await prisma.scenario.findFirst({ where: { id, brokerId: broker.id }, include: { options: true, views: { orderBy: { startedAt: "desc" } } } });
  if (!s) notFound();
  const { rows, recommended } = computeScenario(s, broker.minDscr);
  const url = `${env.appUrl}/b/${broker.slug}/s/${s.token}`;
  const interested = s.options.find((o) => o.id === s.interestedOptionId);
  const totalTime = s.views.reduce((a, v) => a + v.activeSeconds, 0);
  const first = s.investorName.split(" ")[0];
  const shareText = `Hi ${first}, here are the loan options for ${s.propertyAddress.split(",")[0]}: ${url}`;
  const tel = s.investorPhone?.replace(/[^\d+]/g, "");
  const lastView = s.views[0];
  const hot = lastView && Date.now() - lastView.startedAt.getTime() < 48 * 3600_000;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={s.investorName}
        subtitle={`${PURPOSE_LABEL[s.loanPurpose]} · ${s.propertyAddress} · ${usd(s.propertyValue)} · rent ${usd(s.monthlyRent)}/mo`}
        actions={
          <>
            <LinkButton href={`/dashboard/scenarios/${s.id}/edit`} variant="secondary">Edit</LinkButton>
            <form action={duplicateScenario.bind(null, s.id)}><Button variant="secondary">Duplicate</Button></form>
            <LinkButton href={url} target="_blank" variant="secondary">Preview ↗</LinkButton>
            <LinkButton href={`${url}/pdf`} target="_blank" variant="secondary">PDF</LinkButton>
          </>
        }
      />
      {shared && <Notice tone="good">Saved. Share the link below by text or email. You&apos;ll be notified when {first} opens it.</Notice>}
      {interested && (
        <Notice tone="good">
          <strong>{s.investorName} picked Option {interested.label}</strong> {relativeTime(s.interestedAt!)}.{" "}
          {tel ? <a href={`tel:${tel}`} className="underline">Call {s.investorPhone}</a> : s.investorEmail ? <a href={`mailto:${s.investorEmail}`} className="underline">Email {first}</a> : null}
        </Notice>
      )}
      {!interested && hot && <Notice tone="accent"><strong>{first} looked at this {relativeTime(lastView.startedAt)}.</strong> Good moment for a quick call or text.</Notice>}

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">Share link {s.status === "DRAFT" && <Badge tone="warn">Draft: not sent yet</Badge>}</div>
            <div className="truncate font-medium text-accent">{url}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={url} label="Copy link" />
            <a href={`sms:${tel ?? ""}?&body=${encodeURIComponent(shareText)}`} className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-paper">Text link</a>
            <EmailInvestorButton id={s.id} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Opens" value={s.views.length} hint={s.status === "DRAFT" ? "Draft" : "Shared"} />
        <Stat label="Time on page" value={totalTime ? duration(totalTime) : "—"} />
        <Stat label="Last opened" value={lastView ? relativeTime(lastView.startedAt) : "—"} hint={s.firstOpenedAt ? `First ${relativeTime(s.firstOpenedAt)}` : "Not opened yet"} />
        <Stat label="Their choice" value={interested ? `Option ${interested.label}` : "—"} hint={recommended ? `Your pick: Option ${rows.find((r) => r.option.id === recommended)?.option.label}` : "No pick marked"} />
      </div>

      <Card className="overflow-x-auto">
        <CardHeader title="Options" subtitle="★ your recommendation · ✓ the investor's choice" />
        <table className="w-full min-w-[640px]">
          <thead className="bg-paper">
            <tr>
              <Th></Th>
              {rows.map((r) => (
                <Th key={r.option.id} className={cx("text-right", r.option.recommended && "text-accent")}>
                  Option {r.option.label}{r.option.recommended && " ★"}{r.option.id === s.interestedOptionId && " ✓"}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {([
              ["Loan amount", (r) => `${usd(r.option.loanAmount)} (${pct(r.result.ltv)})`],
              ["Rate / term", (r) => `${rate(r.option.ratePct)} · ${r.option.termYears}y${r.option.interestOnly ? ` · IO ${r.option.ioYears}y` : ""}`],
              ["Prepay", (r) => PREPAY_LABEL[r.option.prepay as PrepayType]],
              ["Points / fees", (r) => `${r.option.pointsPct}% · ${usd(r.option.lenderFees)}`],
              ["PITIA", (r) => usd(r.result.pitia)],
              ["DSCR", (r) => ratio(r.result.dscr)],
              ["Cash to close", (r) => usd(r.result.cashToClose)],
              [`${COST_HORIZON_YEARS}-year cost`, (r) => usd(r.result.fiveYearCost)],
              ["Points break-even", (r) => (r.vsBase?.breakEvenMonths ? `${Math.ceil(r.vsBase.breakEvenMonths)} mo vs ${r.vsBase.baseLabel}` : "—")],
            ] as [string, (r: (typeof rows)[number]) => string][]).map(([k, f]) => (
              <tr key={k}><Td className="text-muted">{k}</Td>{rows.map((r) => <Td key={r.option.id} className="num text-right">{f(r)}</Td>)}</tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="View history" subtitle="Opens are logged without IP addresses. Your own previews while signed in are not counted." />
        <ul className="divide-y divide-line">
          {s.views.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Not opened yet.</li>}
          {s.views.map((v) => (
            <li key={v.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>{dateTime(v.startedAt)} <span className="text-muted">· {v.device}</span></span>
              <Badge>{duration(v.activeSeconds)} on page</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <form action={archiveScenario.bind(null, s.id)}><Button variant="danger" size="sm">Archive scenario</Button></form>
    </div>
  );
}
