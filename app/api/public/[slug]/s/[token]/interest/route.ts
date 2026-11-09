import { NextResponse, after } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { pickPublic } from "@/lib/leads";
import { clientKey, rateLimit } from "@/lib/request";
import { computeScenario } from "@/lib/scenarios";
import { rate, ratio, usd } from "@/lib/format";
import { sendEmailSafe } from "@/lib/providers/email";
import { layout, textVersion } from "@/lib/providers/email/templates";
import { dispatchWebhook } from "@/lib/webhooks";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const body = z.object({ optionId: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (!(await rateLimit(`interest:${await clientKey()}`, 10, 3600))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const scenario = await prisma.scenario.findFirst({ where: { token, broker: { slug, active: true }, status: { not: "ARCHIVED" } }, include: { broker: true, options: true } });
  const option = scenario?.options.find((o) => o.id === body.data.optionId);
  if (!scenario || !option) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.scenario.update({ where: { id: scenario.id }, data: { interestedOptionId: option.id, interestedAt: new Date() } });
  const r = computeScenario(scenario).rows.find((x) => x.option.id === option.id)!.result;

  after(async () => {
    const pub = pickPublic(scenario.broker);
    const heading = `${scenario.investorName} is interested in Option ${option.label}`;
    const rows = [
      { label: "Property", value: scenario.propertyAddress },
      { label: "Loan", value: `${usd(option.loanAmount)} at ${rate(option.ratePct)}${option.interestOnly ? " IO" : ""}` },
      { label: "Payment (PITIA)", value: usd(r.pitia) },
      { label: "DSCR", value: ratio(r.dscr) },
      ...(scenario.investorPhone ? [{ label: "Investor phone", value: scenario.investorPhone }] : []),
      ...(scenario.investorEmail ? [{ label: "Investor email", value: scenario.investorEmail }] : []),
    ];
    const cta = { label: "Open scenario", url: `${env.appUrl}/dashboard/scenarios/${scenario.id}` };
    await sendEmailSafe({ to: scenario.broker.notificationEmail, subject: heading, replyTo: scenario.investorEmail ?? undefined, html: layout({ broker: pub, heading, intro: "They tapped “I'm interested” on the scenario page. Reach out while it's fresh.", rows, cta }), text: textVersion(heading, undefined, rows, pub, cta) }, "scenario.interest");
    await dispatchWebhook(scenario.broker, "scenario.option_interest", {
      scenarioId: scenario.id,
      investorName: scenario.investorName,
      investorEmail: scenario.investorEmail,
      investorPhone: scenario.investorPhone,
      propertyAddress: scenario.propertyAddress,
      option: { label: option.label, loanAmount: option.loanAmount, ratePct: option.ratePct, termYears: option.termYears, interestOnly: option.interestOnly, prepay: option.prepay, pitia: Math.round(r.pitia * 100) / 100, dscr: r.dscr },
      dashboardUrl: cta.url,
    });
  });
  return NextResponse.json({ ok: true, label: option.label });
}
