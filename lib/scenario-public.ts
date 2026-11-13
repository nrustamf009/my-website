import type { Broker, Scenario, ScenarioOption } from "@prisma/client";
import { forBroker, prisma } from "@/lib/db";
import { getPublicContext, notificationEmails, type PublicBrand } from "@/lib/broker";
import { auth } from "@/lib/auth/config";
import { emit } from "@/lib/events";
import { dispatchWebhook } from "@/lib/webhooks";
import { sendBrandEmail } from "@/lib/emails";
import { env } from "@/lib/env";
import { dscr, rate, usd } from "@/lib/format";
import { computeOptions } from "./scenarios";
import { engineContext } from "@/lib/broker";

/** Load a scenario by its public token, with the broker context of its owning LO. */
export async function loadPublicScenario(slug: string, token: string) {
  const broker = await prisma.broker.findUnique({ where: { slug }, select: { id: true } });
  if (!broker) return null;
  const s = await forBroker(broker.id).scenario.findFirst({ where: { token }, include: { options: true } });
  if (!s) return null;
  const pc = await getPublicContext(slug, { loId: s.ownerUserId, feature: "scenario" });
  return pc ? { pc, s } : null;
}

/** Broker staff and agency admins previewing a link are never tracked. */
export async function isStaff(brokerId: string, agencyId: string) {
  const session = await auth();
  return !!session?.user && (session.user.brokerId === brokerId || session.user.agencyId === agencyId);
}

async function ownerEmails(broker: Broker, s: Scenario) {
  const owner = await prisma.user.findFirst({ where: { id: s.ownerUserId, brokerId: broker.id } });
  return owner?.email ? [owner.email] : notificationEmails(broker);
}

export async function notifyOpened(broker: Broker, brand: PublicBrand, s: Scenario & { options: ScenarioOption[] }, kind: "first" | "reopen", device: string) {
  const db = forBroker(broker.id);
  const first = s.investorName.split(" ")[0];
  await sendBrandEmail({
    brand,
    internal: true,
    to: await ownerEmails(broker, s),
    subject: kind === "first" ? `${first} just opened your scenario` : `${first} is back on your scenario`,
    heading: kind === "first" ? `${s.investorName} opened the loan options` : `${s.investorName} reopened the loan options`,
    intro: `${s.propertyAddress} · on a ${device === "mobile" ? "phone" : "computer"}. A quick call now usually lands well.`,
    rows: s.investorPhone ? [{ label: "Phone", value: s.investorPhone }] : [],
    cta: { label: "See what they're looking at", url: `${env.appUrl}/dashboard/scenarios/${s.id}` },
    tag: "scenario.opened",
  });
  await dispatchWebhook(db, broker, "scenario.viewed", { scenarioId: s.id, investorName: s.investorName, investorEmail: s.investorEmail, propertyAddress: s.propertyAddress, firstView: kind === "first", device });
}

export async function notifyInterest(broker: Broker, brand: PublicBrand, s: Scenario & { options: ScenarioOption[] }, option: ScenarioOption, question: string | null) {
  const db = forBroker(broker.id);
  const row = computeOptions(s, engineContext(broker).grid).find((r) => r.option.id === option.id)!;
  await sendBrandEmail({
    brand,
    internal: true,
    to: await ownerEmails(broker, s),
    replyTo: s.investorEmail ?? undefined,
    subject: `${s.investorName} picked Option ${option.label}`,
    heading: `${s.investorName} picked Option ${option.label}`,
    intro: question ? `They asked: "${question}"` : `${s.propertyAddress}. Reach out while it's fresh.`,
    rows: [
      { label: "Rate", value: rate(option.rateMilli) },
      { label: "Loan", value: usd(option.loanAmountCents) },
      { label: "Payment", value: `${usd(row.result.pitiaCents)}/mo` },
      { label: "DSCR", value: dscr(row.result.dscrRatio) },
      ...(s.investorPhone ? [{ label: "Phone", value: s.investorPhone }] : []),
      ...(s.investorEmail ? [{ label: "Email", value: s.investorEmail }] : []),
    ],
    cta: { label: "Open the scenario", url: `${env.appUrl}/dashboard/scenarios/${s.id}` },
    tag: "scenario.interest",
  });
  await emit(db, "scenario.interest", "Scenario", s.id, { optionId: option.id, label: option.label, hasQuestion: !!question });
  await dispatchWebhook(db, broker, "scenario.option_interest", {
    scenarioId: s.id,
    investorName: s.investorName,
    investorEmail: s.investorEmail,
    investorPhone: s.investorPhone,
    propertyAddress: s.propertyAddress,
    option: { label: option.label, product: option.product, loanAmountCents: option.loanAmountCents, rateMilli: option.rateMilli, pointsRatio: option.pointsRatio, prepay: option.prepay, pitiaCents: row.result.pitiaCents, dscrRatio: row.result.dscrRatio },
    question,
  });
}
