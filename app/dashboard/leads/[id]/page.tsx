import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features, parseJson } from "@/lib/broker";
import { dateTime, dscr, pct, rate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { LEAD_SOURCE_LABEL } from "@/lib/leads-meta";
import type { Verdict } from "@/lib/dscr";
import { Badge, Card, CardHeader, LinkButton } from "@/components/ui";
import { DeleteLead, LeadNotes, OwnerPicker, StatusPicker } from "@/components/leads/Controls";

export const metadata = { title: "Lead" };

const EVENT_LABEL: Record<string, string> = {
  "lead.created": "Submitted",
  "lead.resubmitted": "Submitted again",
  "lead.status_changed": "Updated",
  "scenario.created": "Scenario created",
  "scenario.shared": "Scenario shared",
  "scenario.opened": "Opened the scenario",
  "scenario.reopened": "Came back to the scenario",
  "scenario.option_expanded": "Looked at option details",
  "scenario.interest": "Picked an option",
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, broker, canManage } = await requireBroker();
  const { id } = await params;
  const l = await db.lead.findFirst({ where: { id }, include: { realtor: true, snapshot: true, consents: { orderBy: { createdAt: "asc" } } } });
  if (!l) notFound();
  const [users, scenarios] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
    db.scenario.findMany({ where: { OR: [{ leadId: l.id }, { investorEmail: l.email }] }, include: { options: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const events = await db.event.findMany({
    where: { OR: [{ entityType: "Lead", entityId: l.id }, { entityType: "Scenario", entityId: { in: scenarios.map((s) => s.id) } }] },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const out = parseJson<{ verdict?: Verdict; dscrRatio?: number | null; pitiaCents?: number; loanAmountCents?: number; rateMilli?: number; cashFlowCents?: number; totalCashNeededCents?: number; maxLoanCents?: number }>(l.engineOutput, {});
  const input = parseJson<{ mode?: string; priceCents?: number; valueCents?: number; rentCents?: number; downPaymentRatio?: number; fico?: string }>(l.engineInput, {});
  const tel = l.phone?.replace(/[^\d+]/g, "");
  const marketing = l.consents.find((c) => c.kind === "MARKETING");

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/leads" className="text-sm text-muted hover:text-ink">← Leads</Link>
      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">{l.name}</h1>
          <p className="mt-1 text-sm text-muted">{LEAD_SOURCE_LABEL[l.source] ?? l.source}{l.realtor ? ` via ${l.realtor.name}, ${l.realtor.brokerage}` : ""} · {dateTime(l.createdAt)}{l.submissions > 1 ? ` · submitted ${l.submissions}×` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tel && <LinkButton href={`tel:${tel}`} variant="accent">Call</LinkButton>}
          <LinkButton href={`mailto:${l.email}`} variant="secondary">Email</LinkButton>
          {features(broker).scenario && <LinkButton href={`/dashboard/scenarios/new?lead=${l.id}`} variant="secondary">Build scenario</LinkButton>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Status" />
            <div className="space-y-4 px-5 pb-5">
              <StatusPicker id={l.id} status={l.status} />
              <div className="max-w-xs"><span className="mb-1 block text-xs text-muted">Owner</span><OwnerPicker id={l.id} owner={l.ownerUserId} users={users} /></div>
            </div>
          </Card>
          {out.verdict && (
            <Card>
              <CardHeader title="Their Instant Check" subtitle={l.propertyAddress ?? undefined} />
              <dl className="grid grid-cols-2 gap-3 px-5 pb-5 text-sm sm:grid-cols-3">
                {([
                  ["Estimate", t.verdict[out.verdict]],
                  ["DSCR", dscr(out.dscrRatio ?? null)],
                  ["Payment", out.pitiaCents ? `${usd(out.pitiaCents)}/mo` : "—"],
                  [input.mode === "CASH_OUT" ? "Value" : "Price", usd(input.priceCents ?? input.valueCents ?? null)],
                  ["Rent", input.rentCents ? `${usd(input.rentCents)}/mo` : "—"],
                  ["Loan", `${usd(out.loanAmountCents ?? null)}${input.downPaymentRatio ? ` · ${pct(input.downPaymentRatio)} down` : ""}`],
                  ["Rate used", rate(out.rateMilli ?? null)],
                  ["Credit", input.fico ?? "—"],
                  ["Cash flow", out.cashFlowCents != null ? `${usd(out.cashFlowCents)}/mo` : "—"],
                ] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>)}
              </dl>
            </Card>
          )}
          {scenarios.length > 0 && (
            <Card>
              <CardHeader title="Scenarios" />
              <ul className="divide-y divide-line">
                {scenarios.map((s) => <li key={s.id}><Link href={`/dashboard/scenarios/${s.id}`} className="flex justify-between px-5 py-3 text-sm hover:bg-paper/60"><span>{s.propertyAddress}</span><span className="text-muted">{s.options.length} options · {s.status.toLowerCase()}</span></Link></li>)}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Notes" />
            <div className="px-5 pb-5"><LeadNotes id={l.id} initial={l.notes ?? ""} /></div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Contact" />
            <dl className="space-y-1.5 px-5 pb-5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd>{l.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Phone</dt><dd>{l.phone ?? "—"}</dd></div>
              {l.utmSource && <div className="flex justify-between gap-3"><dt className="text-muted">Campaign</dt><dd>{[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(" / ")}</dd></div>}
              {l.referrer && <div className="flex justify-between gap-3"><dt className="text-muted">Referrer</dt><dd className="max-w-[14rem] truncate">{l.referrer}</dd></div>}
              {l.snapshot && <div className="flex justify-between gap-3"><dt className="text-muted">Listing</dt><dd><Link href={`/dashboard/snapshots/${l.snapshot.id}`} className="text-accent underline">{l.snapshot.address.split(",")[0]}</Link></dd></div>}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Consent" subtitle={marketing?.granted ? "Can receive marketing" : "Contact about this request only"} />
            <ul className="space-y-1.5 px-5 pb-5 text-sm" data-testid="consents">
              {l.consents.length === 0 && <li className="text-muted">No web consent on file (added by your team).</li>}
              {l.consents.map((c) => <li key={c.id} className="flex justify-between gap-2"><span>{c.kind === "CONTACT" ? "Contact" : c.kind === "MARKETING" ? "Marketing" : "Investment property"} <Badge tone={c.granted ? "good" : "neutral"}>{c.granted ? "yes" : "no"}</Badge></span><span className="text-xs text-muted">{c.textVersion} · {dateTime(c.createdAt)}</span></li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <ol className="space-y-1.5 px-5 pb-5 text-sm" data-testid="lead-timeline">
              {events.map((e) => {
                const m = parseJson<{ to?: string; owner?: string }>(e.meta, {});
                return <li key={e.id} className="flex justify-between gap-2"><span className="text-ink-2">{EVENT_LABEL[e.type] ?? e.type}{m.to ? `: ${m.to.toLowerCase().replace("_", " ")}` : m.owner ? `: owner ${m.owner}` : ""}</span><span className="shrink-0 text-xs text-muted">{dateTime(e.createdAt)}</span></li>;
              })}
            </ol>
          </Card>
          {canManage && <div className="flex justify-end"><DeleteLead id={l.id} name={l.name} /></div>}
        </div>
      </div>
    </div>
  );
}
