import type { Broker, Realtor, Snapshot } from "@prisma/client";
import { forBroker } from "@/lib/db";
import { analyzeDeal, type EngineContext } from "@/lib/dscr";
import { notificationEmails, type PublicBrand } from "@/lib/broker";
import { recordConsents } from "@/lib/compliance/consent";
import { e164, toDealInput, type PublicLeadInput } from "@/lib/check/form";
import { emit } from "@/lib/events";
import { sendBrandEmail } from "@/lib/emails";
import { renderEstimatePdf } from "@/lib/pdf/EstimatePdf";
import { dispatchWebhook } from "@/lib/webhooks";
import { env } from "@/lib/env";
import { dscr, pct, rate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { log } from "@/lib/log";

/**
 * Save (or dedupe) a public lead, record consents and events, then return a `notify`
 * callback (run it in after()) that emails the investor the PDF, alerts the broker and fires the webhook.
 */
export async function createPublicLead(p: {
  broker: Broker;
  brand: PublicBrand;
  ctx: EngineContext;
  input: PublicLeadInput;
  ip: string;
  userAgent: string;
  snapshot?: (Snapshot & { realtor: Realtor }) | null;
}) {
  const { broker, brand, ctx, input, snapshot } = p;
  const db = forBroker(broker.id);
  const deal = toDealInput(input.form);
  const a = analyzeDeal(deal, ctx);
  const email = input.contact.email.toLowerCase();
  const phoneE164 = e164(input.contact.phone);
  const engineOutput = JSON.stringify({ verdict: a.verdict, dscrRatio: a.dscrRatio, pitiaCents: a.pitiaCents, loanAmountCents: a.loanAmountCents, rateMilli: a.rateMilli, maxLoanCents: a.maxLoanCents, cashFlowCents: a.cashFlowCents, totalCashNeededCents: a.totalCashNeededCents });
  const utm = input.utm ?? {};

  // Dedupe within the broker by email or phone: update the existing lead and log a resubmission.
  const existing = await db.lead.findFirst({ where: { OR: [{ email }, ...(phoneE164 ? [{ phoneE164 }] : [])] }, orderBy: { createdAt: "desc" } });
  const data = {
    name: input.contact.name,
    email,
    phone: input.contact.phone || null,
    phoneE164,
    propertyAddress: input.form.address,
    state: input.form.state,
    engineInput: JSON.stringify(input.form),
    engineOutput,
    disclaimerVersionId: brand.disclaimer.id,
    ...(snapshot ? { snapshotId: snapshot.id, realtorId: snapshot.realtorId } : {}),
  };
  const lead = existing
    ? await db.lead.update({ where: { id: existing.id }, data: { ...data, submissions: { increment: 1 }, status: existing.status === "LOST" ? "NEW" : existing.status } })
    : await db.lead.create({
        data: {
          ...data,
          brokerId: broker.id,
          source: input.source,
          ownerUserId: brand.lo.id,
          utmSource: utm.utm_source ?? null,
          utmMedium: utm.utm_medium ?? null,
          utmCampaign: utm.utm_campaign ?? null,
          utmTerm: utm.utm_term ?? null,
          utmContent: utm.utm_content ?? null,
          referrer: input.referrer ?? null,
        },
      });
  await recordConsents(db, { leadId: lead.id, company: broker.companyName, ip: p.ip, userAgent: p.userAgent, contact: true, marketing: input.contact.consentMarketing, investment: true });
  await emit(db, existing ? "lead.resubmitted" : "lead.created", "Lead", lead.id, { source: input.source, verdict: a.verdict, realtorId: snapshot?.realtorId ?? null, utmSource: utm.utm_source ?? null });

  const notify = async () => {
    const first = input.contact.name.split(" ")[0];
    try {
      const pdf = await renderEstimatePdf({ brand, ctx, input: deal, address: input.form.address, investor: input.contact.name });
      await sendBrandEmail({
        brand,
        to: email,
        subject: `Your DSCR estimate for ${input.form.address.split(",")[0]}`,
        heading: "Your DSCR estimate",
        hero: { label: "Estimated debt service coverage", value: dscr(a.dscrRatio), note: t.verdict[a.verdict] },
        intro: `Hi ${first}, here's your estimate for ${input.form.address}. The PDF has the full breakdown, the cash you'd need, and what would change the outcome.`,
        rows: [
          { label: "Estimated DSCR", value: `${dscr(a.dscrRatio)} · ${t.verdict[a.verdict]}` },
          { label: "Estimated payment (PITIA)", value: `${usd(a.pitiaCents)}/mo` },
          { label: "Estimated cash flow", value: `${usd(a.cashFlowCents)}/mo` },
        ],
        footerNote: `You're receiving this because you requested an estimate from ${broker.companyName}.`,
        replyTo: brand.lo.email,
        fromName: `${brand.lo.name} · ${broker.companyName}`,
        attachments: [{ filename: `DSCR-estimate-${input.form.address.split(",")[0]!.replace(/[^a-z0-9]+/gi, "-")}.pdf`, content: pdf }],
        tag: "lead.investor_pdf",
      });
    } catch (err) {
      log.error("lead.pdf_failed", err);
    }
    const heading = snapshot ? `New listing lead via ${snapshot.realtor.name}` : existing ? "Returning lead submitted again" : "New Instant Check lead";
    await sendBrandEmail({
      brand,
      internal: true,
      to: notificationEmails(broker),
      subject: `${heading}: ${input.contact.name} · DSCR ${dscr(a.dscrRatio)}`,
      heading,
      intro: `${input.contact.name} requested the full estimate and agreed to be contacted.`,
      rows: [
        { label: "Name", value: input.contact.name },
        { label: "Email", value: email },
        { label: "Phone", value: input.contact.phone || "—" },
        { label: "Property", value: input.form.address },
        { label: t.mode[a.mode], value: usd(a.valueCents) },
        { label: "Loan / LTV", value: `${usd(a.loanAmountCents)} · ${pct(a.ltvRatio)}` },
        { label: "Rent", value: `${usd(a.qualifyingRentCents)}/mo` },
        { label: "FICO range", value: input.form.fico },
        { label: "Rate used", value: rate(a.rateMilli) },
        { label: "DSCR", value: `${dscr(a.dscrRatio)} (${t.verdict[a.verdict]})` },
        ...(snapshot ? [{ label: "Referred by", value: `${snapshot.realtor.name}, ${snapshot.realtor.brokerage}` }] : []),
        ...(utm.utm_source ? [{ label: "UTM source", value: utm.utm_source }] : []),
      ],
      cta: { label: "Open lead", url: `${env.appUrl}/dashboard/leads/${lead.id}` },
      replyTo: email,
      tag: "lead.broker_alert",
    });
    await dispatchWebhook(db, broker, existing ? "lead.updated" : snapshot ? "snapshot.lead" : "lead.created", {
      lead: { id: lead.id, source: lead.source, status: lead.status, name: lead.name, email: lead.email, phone: lead.phone, createdAt: lead.createdAt.toISOString(), submissions: lead.submissions },
      property: { address: input.form.address, state: input.form.state, propertyType: input.form.propertyType, mode: a.mode },
      estimate: { verdict: a.verdict, dscr: dscr(a.dscrRatio), pitia: usd(a.pitiaCents, { cents: true }), loanAmount: usd(a.loanAmountCents), ltv: pct(a.ltvRatio), rate: rate(a.rateMilli), cashFlow: usd(a.cashFlowCents) },
      consent: { contact: true, marketing: input.contact.consentMarketing, investmentProperty: true },
      realtor: snapshot ? { id: snapshot.realtor.id, name: snapshot.realtor.name, brokerage: snapshot.realtor.brokerage } : null,
      utm,
      dashboardUrl: `${env.appUrl}/dashboard/leads/${lead.id}`,
    });
  };

  return { lead, analysis: a, notify, deduped: !!existing };
}
