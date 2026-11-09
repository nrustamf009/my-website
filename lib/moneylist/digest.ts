import type { Broker, ClosedLoan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { evaluateAll, settingsFromBroker } from "@/lib/dscr";
import { pickPublic } from "@/lib/leads";
import { sendEmailSafe } from "@/lib/providers/email";
import { esc, layout } from "@/lib/providers/email/templates";

export function moneyListFor(broker: Broker & { closedLoans: ClosedLoan[] }, asOf = new Date()) {
  return evaluateAll(broker.closedLoans.filter((l) => !l.contactedAt), settingsFromBroker(broker), asOf);
}

/** Email the broker their top Money List opportunities. */
export async function sendMoneyListDigest(brokerId: string): Promise<{ sent: boolean; count: number }> {
  const broker = await prisma.broker.findUniqueOrThrow({ where: { id: brokerId }, include: { closedLoans: true } });
  const list = moneyListFor(broker);
  const top = list.slice(0, 10);
  const pub = pickPublic(broker);
  const items = top
    .map(
      ({ loan, opp }) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e5e4">
<div style="font-weight:600;color:#1c1917">${esc(loan.borrowerName)}</div>
<div style="color:#57534e;font-size:13px">${esc(loan.propertyAddress)}</div>
<div style="font-size:13px;margin-top:4px">${opp.reasons.map((r) => `<span style="display:inline-block;background:#f5f5f4;border-radius:999px;padding:2px 8px;margin:2px 4px 0 0">${esc(r.label)}</span>`).join("")}</div>
<div style="color:${broker.accentColor};font-size:13px;margin-top:4px">${esc(opp.benefit)}</div></td></tr>`,
    )
    .join("");
  const intro = list.length
    ? `${list.length} past client${list.length === 1 ? " is" : "s are"} worth a call this month. Here are the top ${top.length}, ranked by estimated benefit to the client.`
    : "No new opportunities this month. We'll keep watching your closed loans.";
  const sent = await sendEmailSafe(
    {
      to: broker.notificationEmail,
      subject: list.length ? `Your Money List: ${list.length} refi opportunit${list.length === 1 ? "y" : "ies"}` : "Your Money List: nothing new this month",
      html: layout({
        broker: pub,
        heading: "Your monthly Money List",
        intro,
        bodyHtml: items ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>` : "",
        cta: { label: "Open Money List", url: `${env.appUrl}/dashboard/money-list` },
        footerNote: broker.marketRate ? `Based on the market rate you entered: ${broker.marketRate.toFixed(3)}%. Update it on the Money List page.` : "Tip: enter today's market rate on the Money List page to find rate-drop opportunities.",
      }),
      text: `${intro}\n\n${top.map(({ loan, opp }) => `- ${loan.borrowerName}, ${loan.propertyAddress}: ${opp.benefit}`).join("\n")}\n\n${env.appUrl}/dashboard/money-list`,
    },
    "moneylist.digest",
  );
  if (sent) await prisma.broker.update({ where: { id: broker.id }, data: { lastDigestAt: new Date() } });
  return { sent, count: list.length };
}
