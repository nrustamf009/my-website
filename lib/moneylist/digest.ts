import type { Broker } from "@prisma/client";
import { forBroker } from "@/lib/db";
import { features, moneyListRules, notificationEmails, staffBrand } from "@/lib/broker";
import { sendBrandEmail } from "@/lib/emails";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { buildMoneyList } from "./list";
import { describeOpportunity, triggerShort } from "./describe";

/** Monthly "who to call" email to the broker's notification addresses. Internal: never sent to borrowers. */
export async function sendMoneyListDigest(broker: Broker, opts: { userId?: string | null; manual?: boolean } = {}): Promise<{ sent: boolean; count: number; reason?: string }> {
  if (!features(broker).moneyList) return { sent: false, count: 0, reason: "Money List is off" };
  if (broker.status === "SUSPENDED") return { sent: false, count: 0, reason: "Account suspended" };
  const db = forBroker(broker.id);
  const { rows, total } = await buildMoneyList(db, broker);
  if (!total) return { sent: false, count: 0, reason: "No closed loans imported yet" };
  const horizon = moneyListRules(broker).horizonMonths;
  const top = rows.slice(0, 10);
  const brand = await staffBrand(broker, null);
  const sent = await sendBrandEmail({
    brand,
    internal: true,
    to: notificationEmails(broker),
    subject: rows.length ? `Money List: ${rows.length} past client${rows.length === 1 ? "" : "s"} worth a call this month` : "Money List: no new opportunities this month",
    heading: rows.length ? `${rows.length} past client${rows.length === 1 ? "" : "s"} to call` : "Nothing urgent this month",
    intro: rows.length
      ? "Ranked by estimated net benefit to the client, then urgency. Open the Money List for drafts you can copy and send."
      : `We checked all ${total} closed loans. We'll keep watching for expiring prepay penalties, seasoning milestones and rate drops.`,
    rows: top.map(({ loan, evaluation }) => {
      const op = describeOpportunity(evaluation, horizon);
      return { label: `${loan.borrowerName} · ${loan.propertyAddress.split(",")[0]}`, value: `${op.benefitLabel} · ${evaluation.triggers.map(triggerShort).join(", ")}` };
    }),
    cta: { label: "Open the Money List", url: `${env.appUrl}/dashboard/money-list` },
    tag: "moneylist.digest",
  });
  if (sent) await prisma.broker.update({ where: { id: broker.id }, data: { lastDigestAt: new Date() } });
  return { sent, count: rows.length, reason: sent ? undefined : "Email could not be sent" };
}

/** Cron: send to every active broker whose last digest is older than 25 days. */
export async function runMonthlyDigests(now = new Date()) {
  const cutoff = new Date(now.getTime() - 25 * 86_400_000);
  const brokers = await prisma.broker.findMany({ where: { status: { not: "SUSPENDED" }, OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: cutoff } }] } });
  let sent = 0;
  for (const b of brokers) {
    const r = await sendMoneyListDigest(b);
    if (r.sent) sent++;
  }
  return { checked: brokers.length, sent };
}
