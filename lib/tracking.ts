import type { Broker, Scenario } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { pickPublic } from "@/lib/leads";
import { sendEmailSafe } from "@/lib/providers/email";
import { layout, textVersion } from "@/lib/providers/email/templates";
import { dispatchWebhook } from "@/lib/webhooks";

const REOPEN_GAP_MS = 24 * 3600_000;
const MAX_PING_SECONDS = 30;

/**
 * Record a scenario open. Notifies the broker on the first open, and again when the
 * investor comes back 24+ hours after their previous visit.
 */
export async function recordScenarioOpen(scenario: Scenario, broker: Broker, visitKey: string, device: string) {
  const existing = await prisma.scenarioView.findUnique({ where: { visitKey } });
  if (existing) return { notified: false };
  const previous = await prisma.scenarioView.findFirst({ where: { scenarioId: scenario.id }, orderBy: { lastSeenAt: "desc" } });
  await prisma.scenarioView.create({ data: { scenarioId: scenario.id, visitKey, device } });

  const now = Date.now();
  const firstView = !scenario.firstOpenedAt;
  const repeatAfterGap = !firstView && (!previous || now - previous.lastSeenAt.getTime() >= REOPEN_GAP_MS) && (!scenario.lastNotifiedAt || now - scenario.lastNotifiedAt.getTime() >= REOPEN_GAP_MS);
  if (!firstView && !repeatAfterGap) return { notified: false };

  await prisma.scenario.update({ where: { id: scenario.id }, data: { lastNotifiedAt: new Date(), ...(firstView ? { firstOpenedAt: new Date() } : {}) } });
  const pub = pickPublic(broker);
  const heading = `${scenario.investorName} is viewing your scenario now`;
  const intro = firstView
    ? `${scenario.investorName} just opened the loan options for ${scenario.propertyAddress} for the first time. Good moment for a quick call or text.`
    : `${scenario.investorName} came back to the loan options for ${scenario.propertyAddress}. Returning visits usually mean they're deciding.`;
  const cta = { label: "Open scenario", url: `${env.appUrl}/dashboard/scenarios/${scenario.id}` };
  await sendEmailSafe(
    { to: broker.notificationEmail, subject: heading, html: layout({ broker: pub, heading, intro, rows: scenario.investorPhone ? [{ label: "Investor phone", value: scenario.investorPhone }] : undefined, cta }), text: textVersion(heading, intro, undefined, pub, cta) },
    "scenario.viewed",
  );
  await dispatchWebhook(broker, "scenario.viewed", {
    scenarioId: scenario.id,
    investorName: scenario.investorName,
    investorEmail: scenario.investorEmail,
    propertyAddress: scenario.propertyAddress,
    firstView,
    device,
    dashboardUrl: cta.url,
  });
  return { notified: true };
}

export async function recordScenarioPing(scenarioId: string, visitKey: string, seconds: number) {
  const add = Math.max(0, Math.min(MAX_PING_SECONDS, Math.round(seconds)));
  await prisma.scenarioView.updateMany({ where: { visitKey, scenarioId }, data: { activeSeconds: { increment: add }, lastSeenAt: new Date() } });
}
