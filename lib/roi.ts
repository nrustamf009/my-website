import type { Agency, Broker } from "@prisma/client";
import { forBroker, prisma } from "@/lib/db";
import { features, notificationEmails, staffBrand } from "@/lib/broker";
import { sendBrandEmail, sendPlatformEmail } from "@/lib/emails";
import { env } from "@/lib/env";
import { buildMoneyList } from "@/lib/moneylist/list";
import { agencyBrokerStats, roiStats, type RoiStats } from "@/lib/stats";

const DAY = 86_400_000;
const delta = (now: number, prev: number) => (now === prev ? "same as last week" : `${now > prev ? "▲" : "▼"} ${Math.abs(now - prev)} vs last week`);

/** Weekly "what the toolkit did for you" email to the broker's notification addresses. */
export async function sendWeeklyRoi(broker: Broker, now = new Date()): Promise<{ sent: boolean; stats: RoiStats }> {
  const db = forBroker(broker.id);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [w, p] = await Promise.all([roiStats(db, weekAgo, now), roiStats(db, new Date(now.getTime() - 14 * DAY), weekAgo)]);
  const f = features(broker);
  const ml = f.moneyList ? await buildMoneyList(db, broker) : null;
  const brand = await staffBrand(broker, null);
  const rows = [
    { label: "New leads", value: `${w.leads} (${delta(w.leads, p.leads)})` },
    ...(f.check ? [{ label: "Instant checks run", value: `${w.checks} (${delta(w.checks, p.checks)})` }] : []),
    ...(f.scenario ? [{ label: "Scenario opens", value: `${w.scenarioOpens}` }, { label: "Options picked", value: `${w.scenarioInterest}` }] : []),
    ...(f.snapshot ? [{ label: "Listing QR scans", value: `${w.snapshotScans}` }] : []),
    ...(f.moneyList ? [{ label: "Past clients contacted", value: `${w.moneyListContacted}` }, { label: "Refi opportunities waiting", value: `${ml?.rows.length ?? 0}` }] : []),
  ];
  const sent = await sendBrandEmail({
    brand,
    internal: true,
    to: notificationEmails(broker),
    subject: `Your week: ${w.leads} new lead${w.leads === 1 ? "" : "s"}, ${w.scenarioOpens} scenario open${w.scenarioOpens === 1 ? "" : "s"}`,
    heading: "Your week with the DSCR Investor Toolkit",
    intro: w.leads || w.scenarioOpens || w.snapshotScans ? "Here's what your tools did in the last 7 days." : "A quiet week. Sharing your Instant Check link in one investor group usually changes that.",
    rows,
    cta: { label: "Open your dashboard", url: `${env.appUrl}/dashboard` },
    tag: "roi.weekly",
  });
  if (sent) await prisma.broker.update({ where: { id: broker.id }, data: { lastRoiEmailAt: now } });
  return { sent, stats: w };
}

export async function runWeeklyRoi(now = new Date()) {
  const cutoff = new Date(now.getTime() - 6 * DAY);
  const brokers = await prisma.broker.findMany({ where: { status: "ACTIVE", OR: [{ lastRoiEmailAt: null }, { lastRoiEmailAt: { lt: cutoff } }] } });
  let sent = 0;
  for (const b of brokers) if ((await sendWeeklyRoi(b, now)).sent) sent++;
  return { checked: brokers.length, sent };
}

/** Monthly rollup for the agency: per-broker usage and churn signals. */
export async function sendAgencyRollup(agency: Agency, now = new Date()) {
  const brokers = await prisma.broker.findMany({ where: { agencyId: agency.id }, orderBy: { companyName: "asc" } });
  const admins = await prisma.user.findMany({ where: { agencyId: agency.id, role: "AGENCY_ADMIN", active: true }, select: { email: true } });
  if (!admins.length || !brokers.length) return { sent: false };
  const stats = await agencyBrokerStats(brokers);
  const paragraphs = brokers.map((b) => {
    const s = stats.get(b.id)!;
    const quiet = !s.lastActivity || now.getTime() - s.lastActivity.getTime() > 14 * DAY;
    return `${b.companyName}${b.status !== "ACTIVE" ? ` (${b.status.toLowerCase()})` : ""}: ${s.leads30} leads, ${s.opens30} scenario opens, ${s.scans30} QR scans, ${s.contacted30} past clients contacted, ${s.opportunities} refi opportunities waiting.${quiet ? " ⚠ No activity in 14+ days." : ""}`;
  });
  const total = [...stats.values()].reduce((n, s) => n + s.leads30, 0);
  const sent = await sendPlatformEmail({
    to: admins.map((a) => a.email),
    subject: `${agency.name}: ${total} leads across ${brokers.length} brokers this month`,
    heading: "Monthly broker rollup",
    paragraphs: ["Last 30 days, per broker:", ...paragraphs],
    cta: { label: "Open agency admin", url: `${env.appUrl}/admin` },
    tag: "roi.agency_rollup",
  });
  if (sent) await prisma.agency.update({ where: { id: agency.id }, data: { lastRollupAt: now } });
  return { sent };
}

export async function runAgencyRollups(now = new Date()) {
  const cutoff = new Date(now.getTime() - 25 * DAY);
  const agencies = await prisma.agency.findMany({ where: { OR: [{ lastRollupAt: null }, { lastRollupAt: { lt: cutoff } }] } });
  let sent = 0;
  for (const a of agencies) if ((await sendAgencyRollup(a, now)).sent) sent++;
  return { checked: agencies.length, sent };
}
