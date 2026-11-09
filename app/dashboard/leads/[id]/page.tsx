import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { brokerDefaults } from "@/lib/broker";
import { analyzeDeal, VERDICT_LABEL, type FicoRange } from "@/lib/dscr";
import { dateTime, pct, rate, ratio, usd } from "@/lib/format";
import { setLeadStatus } from "@/lib/actions/leads";
import { Badge, Button, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { broker } = await requireBroker();
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, brokerId: broker.id }, include: { realtor: true, snapshot: true } });
  if (!lead) notFound();
  const a =
    lead.purchasePrice && lead.monthlyRent != null && lead.downPaymentPct != null
      ? analyzeDeal(
          {
            price: lead.purchasePrice,
            downPaymentPct: lead.downPaymentPct,
            monthlyRent: lead.monthlyRent,
            fico: lead.ficoRange as FicoRange | null,
            ...(lead.snapshot ? { taxesMonthly: lead.snapshot.taxesMonthly, insuranceMonthly: lead.snapshot.insuranceMonthly, hoaMonthly: lead.snapshot.hoaMonthly, ratePct: lead.snapshot.ratePct } : {}),
          },
          brokerDefaults(broker),
        )
      : null;
  const tel = lead.phone?.replace(/[^\d+]/g, "");
  const scenarioQs = new URLSearchParams({ leadId: lead.id });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={lead.name}
        subtitle={<>{lead.source === "LISTING" ? `Listing lead via ${lead.realtor?.name ?? "realtor"}` : "Instant Check lead"} · {dateTime(lead.createdAt)}</>}
        actions={
          <>
            {tel && <LinkButton href={`tel:${tel}`} variant="accent">Call {lead.phone}</LinkButton>}
            <LinkButton href={`mailto:${lead.email}`} variant="secondary">Email</LinkButton>
            <LinkButton href={`/dashboard/scenarios/new?${scenarioQs}`} variant="secondary">Build scenario</LinkButton>
          </>
        }
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Contact" action={<Badge tone={lead.status === "NEW" ? "accent" : "neutral"}>{lead.status.toLowerCase()}</Badge>} />
          <dl className="space-y-2 p-5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Email</dt><dd>{lead.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Phone</dt><dd>{lead.phone ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Credit range</dt><dd>{lead.ficoRange ?? "—"}</dd></div>
            <div className="border-t border-line pt-2 text-xs text-muted">Consent given {dateTime(lead.consentAt)}: “{lead.consentText}”</div>
          </dl>
          <div className="flex gap-2 border-t border-line p-4">
            {lead.status !== "CONTACTED" && <form action={setLeadStatus.bind(null, lead.id, "CONTACTED")}><Button size="sm">Mark contacted</Button></form>}
            {lead.status !== "ARCHIVED" ? <form action={setLeadStatus.bind(null, lead.id, "ARCHIVED")}><Button size="sm" variant="ghost">Archive</Button></form> : <form action={setLeadStatus.bind(null, lead.id, "NEW")}><Button size="sm" variant="ghost">Restore</Button></form>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Deal" subtitle={lead.propertyAddress ?? undefined} />
          {a ? (
            <dl className="space-y-2 p-5 text-sm">
              <div className="flex items-center justify-between"><dt className="text-muted">DSCR</dt><dd className="flex items-center gap-2"><span className="num font-display text-2xl">{ratio(a.dscr)}</span><Badge tone={a.verdict === "LIKELY" ? "good" : a.verdict === "BORDERLINE" ? "warn" : "bad"}>{VERDICT_LABEL[a.verdict]}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-muted">Price</dt><dd className="num">{usd(a.price)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Down payment</dt><dd className="num">{pct(a.downPaymentPct)} · {usd(a.downPayment)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Loan-to-value</dt><dd className="num">{pct(a.ltv)} <span className="text-muted">(max {pct(a.maxLtv)} for {lead.ficoRange ?? "this credit"})</span></dd></div>
              <div className="flex justify-between"><dt className="text-muted">Rent</dt><dd className="num">{usd(a.monthlyRent)}/mo</dd></div>
              <div className="flex justify-between"><dt className="text-muted">PITIA at {rate(a.ratePct)}</dt><dd className="num">{usd(a.pitia)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Max loan estimate</dt><dd className="num">{usd(a.maxLoan)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Rent for DSCR {a.minDscr.toFixed(2)}</dt><dd className="num">{usd(a.rentForMinDscr)}</dd></div>
            </dl>
          ) : (
            <p className="p-5 text-sm text-muted">No deal details.</p>
          )}
        </Card>
      </div>
      {a && (
        <Card>
          <CardHeader title="Talking points" subtitle="Why the check came out this way, and what would change it" />
          <div className="space-y-3 p-5 text-sm">
            <p className="text-ink-2">
              {a.verdict === "LIKELY"
                ? `Rent covers the payment ${ratio(a.dscr)}x and ${pct(a.ltv)} LTV is within the ${pct(a.maxLtv)} limit for ${lead.ficoRange ?? "their credit range"}. Lead with a pre-qualification.`
                : a.ltv > a.maxLtv + 1e-9 && (a.dscr ?? 0) >= a.minDscr
                  ? `The rent works (DSCR ${ratio(a.dscr)}), but ${pct(a.ltv)} LTV is above the ${pct(a.maxLtv)} limit for ${lead.ficoRange} credit. The fix is more down payment, or a credit bump into the next range.`
                  : `DSCR ${ratio(a.dscr)} is below the ${a.minDscr.toFixed(2)} minimum: rent needs to be about ${usd(a.rentForMinDscr)}/mo at this price and down payment.`}
            </p>
            {a.suggestions.length > 0 && (
              <ul className="space-y-2">
                {a.suggestions.map((sg) => (
                  <li key={sg.title} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><span><strong className="font-medium text-ink">{sg.title}.</strong> <span className="text-muted">{sg.detail}</span></span></li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
