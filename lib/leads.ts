import type { Broker, Realtor, Snapshot } from "@prisma/client";
import { prisma } from "@/lib/db";
import { brokerDefaults, PUBLIC_BROKER_SELECT, type PublicBroker } from "@/lib/broker";
import { analyzeDeal, VERDICT_LABEL, type DealInput, type FicoRange } from "@/lib/dscr";
import { renderDealAnalysisPdf } from "@/lib/pdf/DealAnalysisPdf";
import { sendEmailSafe } from "@/lib/providers/email";
import { layout, textVersion, type Row } from "@/lib/providers/email/templates";
import { dispatchWebhook } from "@/lib/webhooks";
import { env } from "@/lib/env";
import { pct, rate, ratio, usd } from "@/lib/format";
import { CONSENT_TEXT, type PublicLeadInput } from "@/lib/validation";
import { log } from "@/lib/log";

export function pickPublic(b: Broker): PublicBroker {
  return Object.fromEntries(Object.keys(PUBLIC_BROKER_SELECT).map((k) => [k, b[k as keyof Broker]])) as PublicBroker;
}

/**
 * Save a public lead, then (in the background) email the investor the PDF,
 * email the broker the numbers, and fire the webhook.
 */
export async function createPublicLead(broker: Broker, input: PublicLeadInput, snapshot?: (Snapshot & { realtor: Realtor }) | null) {
  const defaults = brokerDefaults(broker);
  const deal: DealInput = {
    price: input.deal.price,
    downPaymentPct: input.deal.downPaymentPct,
    monthlyRent: input.deal.monthlyRent,
    fico: (input.deal.fico ?? null) as FicoRange | null,
    ratePct: input.deal.ratePct,
    interestOnly: input.deal.interestOnly,
    hoaMonthly: input.deal.hoaMonthly,
    ...(snapshot ? { taxesMonthly: snapshot.taxesMonthly, insuranceMonthly: snapshot.insuranceMonthly, hoaMonthly: snapshot.hoaMonthly, ratePct: input.deal.ratePct ?? snapshot.ratePct } : {}),
  };
  const analysis = analyzeDeal(deal, defaults);

  const lead = await prisma.lead.create({
    data: {
      brokerId: broker.id,
      source: input.source,
      name: input.contact.name,
      email: input.contact.email.toLowerCase(),
      phone: input.contact.phone || null,
      consentAt: new Date(),
      consentText: CONSENT_TEXT,
      propertyAddress: input.deal.address,
      purchasePrice: Math.round(input.deal.price),
      downPaymentPct: input.deal.downPaymentPct,
      monthlyRent: Math.round(input.deal.monthlyRent),
      ficoRange: input.deal.fico ?? null,
      resultJson: JSON.stringify({ dscr: analysis.dscr, verdict: analysis.verdict, pitia: analysis.pitia, maxLoan: analysis.maxLoan, loanAmount: analysis.loanAmount, ratePct: analysis.ratePct }),
      snapshotId: snapshot?.id ?? null,
      realtorId: snapshot?.realtorId ?? null,
    },
  });

  const pub = pickPublic(broker);
  const notify = async () => {
    try {
      const pdf = await renderDealAnalysisPdf({ broker: pub, defaults, input: deal, address: input.deal.address, investorName: input.contact.name });
      const rows: Row[] = [
        { label: "Estimated DSCR", value: `${ratio(analysis.dscr)} · ${VERDICT_LABEL[analysis.verdict]}` },
        { label: "Estimated payment (PITIA)", value: usd(analysis.pitia) },
        { label: "Max loan estimate", value: usd(analysis.maxLoan) },
      ];
      const first = input.contact.name.split(" ")[0];
      const intro = `Hi ${first}, here is your DSCR analysis for ${input.deal.address}. The full breakdown, including what would change the outcome, is attached as a PDF.`;
      await sendEmailSafe(
        {
          to: lead.email,
          subject: `Your DSCR analysis for ${input.deal.address.split(",")[0]}`,
          replyTo: broker.email,
          fromName: `${broker.name} · ${broker.companyName}`,
          html: layout({ broker: pub, heading: "Your DSCR analysis", intro, rows, footerNote: `You're receiving this because you requested an analysis on ${broker.companyName}'s website.` }),
          text: textVersion("Your DSCR analysis", intro, rows, pub),
          attachments: [{ filename: `DSCR-analysis-${input.deal.address.split(",")[0]!.replace(/[^a-z0-9]+/gi, "-")}.pdf`, content: pdf }],
        },
        "lead.investor_pdf",
      );
    } catch (err) {
      log.error("lead.pdf_failed", err);
    }

    const brokerRows: Row[] = [
      { label: "Name", value: lead.name },
      { label: "Email", value: lead.email },
      { label: "Phone", value: lead.phone ?? "—" },
      { label: "Property", value: input.deal.address },
      { label: "Price", value: usd(input.deal.price) },
      { label: "Down payment", value: pct(input.deal.downPaymentPct) },
      { label: "Rent", value: `${usd(input.deal.monthlyRent)}/mo` },
      { label: "FICO", value: input.deal.fico ?? "—" },
      { label: "Rate used", value: rate(analysis.ratePct) },
      { label: "DSCR", value: `${ratio(analysis.dscr)} (${VERDICT_LABEL[analysis.verdict]})` },
      { label: "PITIA", value: usd(analysis.pitia) },
      ...(snapshot ? [{ label: "Referred by realtor", value: `${snapshot.realtor.name}, ${snapshot.realtor.brokerage}` }] : []),
    ];
    const heading = snapshot ? `New listing lead via ${snapshot.realtor.name}` : "New Instant Check lead";
    await sendEmailSafe(
      {
        to: broker.notificationEmail,
        subject: `${heading}: ${lead.name} · DSCR ${ratio(analysis.dscr)}`,
        replyTo: lead.email,
        html: layout({ broker: pub, heading, intro: `${lead.name} just requested the full analysis. They agreed to be contacted.`, rows: brokerRows, cta: { label: "Open lead", url: `${env.appUrl}/dashboard/leads/${lead.id}` } }),
        text: textVersion(heading, undefined, brokerRows, pub, { label: "Open lead", url: `${env.appUrl}/dashboard/leads/${lead.id}` }),
      },
      "lead.broker_alert",
    );

    await dispatchWebhook(broker, "lead.created", {
      lead: { id: lead.id, source: lead.source, name: lead.name, email: lead.email, phone: lead.phone, consentAt: lead.consentAt.toISOString(), createdAt: lead.createdAt.toISOString() },
      property: { address: input.deal.address, purchasePrice: input.deal.price, downPaymentPct: input.deal.downPaymentPct, monthlyRent: input.deal.monthlyRent, ficoRange: input.deal.fico ?? null },
      results: { dscr: analysis.dscr, verdict: analysis.verdict, pitia: Math.round(analysis.pitia * 100) / 100, loanAmount: analysis.loanAmount, maxLoan: Math.round(analysis.maxLoan), ratePct: analysis.ratePct },
      realtor: snapshot ? { id: snapshot.realtor.id, name: snapshot.realtor.name, brokerage: snapshot.realtor.brokerage } : null,
      dashboardUrl: `${env.appUrl}/dashboard/leads/${lead.id}`,
    });
  };

  return { lead, analysis, notify };
}
