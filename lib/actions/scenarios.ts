"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ScenarioInputSchema, type ScenarioInput } from "@/lib/scenario-schema";
import { prisma } from "@/lib/db";
import { requireBroker } from "@/lib/auth/session";
import { randomToken } from "@/lib/tokens";
import { env } from "@/lib/env";
import { fieldErrors } from "@/lib/validation";
import { pickPublic } from "@/lib/leads";
import { sendEmailSafe } from "@/lib/providers/email";
import { layout, textVersion } from "@/lib/providers/email/templates";
import { computeScenario } from "@/lib/scenarios";
import { rate, ratio, usd } from "@/lib/format";

export type SaveState = { fieldErrors?: Record<string, string>; error?: string };

export async function saveScenario(id: string | null, input: ScenarioInput, share: boolean, callId?: string | null): Promise<SaveState> {
  const { broker } = await requireBroker();
  const parsed = ScenarioInputSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  for (const o of d.options) if (o.loanAmount > d.propertyValue) return { fieldErrors: { [`options.${d.options.indexOf(o)}.loanAmount`]: "Loan can't exceed the property value" } };

  const data = {
    investorName: d.investorName,
    investorEmail: d.investorEmail || null,
    investorPhone: d.investorPhone || null,
    propertyAddress: d.propertyAddress,
    loanPurpose: d.loanPurpose,
    propertyValue: Math.round(d.propertyValue),
    monthlyRent: Math.round(d.monthlyRent),
    taxesMonthly: d.taxesMonthly,
    insuranceMonthly: d.insuranceMonthly,
    hoaMonthly: d.hoaMonthly,
    note: d.note || null,
  };
  const firstRec = d.options.findIndex((o) => o.recommended);
  const options = d.options.map((o, i) => ({ ...o, recommended: i === firstRec, loanAmount: Math.round(o.loanAmount), lenderFees: Math.round(o.lenderFees), ioYears: o.interestOnly ? (o.ioYears ?? 10) : null, sortOrder: i }));

  let scenarioId = id;
  if (id) {
    const existing = await prisma.scenario.findFirst({ where: { id, brokerId: broker.id } });
    if (!existing) return { error: "Scenario not found" };
    await prisma.$transaction([
      prisma.scenarioOption.deleteMany({ where: { scenarioId: id } }),
      prisma.scenario.update({ where: { id }, data: { ...data, interestedOptionId: null, ...(share ? { status: "SHARED" } : {}), options: { create: options } } }),
    ]);
  } else {
    const created = await prisma.scenario.create({
      data: { ...data, brokerId: broker.id, token: randomToken(20), status: share ? "SHARED" : "DRAFT", origin: callId ? "CALL" : "MANUAL", options: { create: options } },
    });
    scenarioId = created.id;
    if (callId) await prisma.callSession.updateMany({ where: { id: callId, brokerId: broker.id }, data: { scenarioId, status: "CONVERTED" } });
  }
  revalidatePath("/dashboard/scenarios");
  redirect(`/dashboard/scenarios/${scenarioId}${share ? "?shared=1" : ""}`);
}

export async function emailScenarioToInvestor(id: string): Promise<{ ok: boolean; message: string }> {
  const { broker } = await requireBroker();
  const s = await prisma.scenario.findFirst({ where: { id, brokerId: broker.id } });
  if (!s) return { ok: false, message: "Scenario not found" };
  if (!s.investorEmail) return { ok: false, message: "Add the investor's email first." };
  const url = `${env.appUrl}/b/${broker.slug}/s/${s.token}`;
  const pub = pickPublic(broker);
  const first = s.investorName.split(" ")[0];
  const full = await prisma.scenario.findFirstOrThrow({ where: { id }, include: { options: true } });
  const { rows: computed, recommended } = computeScenario(full, broker.minDscr);
  const rows = computed.map((r) => ({
    label: `Option ${r.option.label}${r.option.id === recommended ? " (my pick)" : ""}`,
    value: `${usd(r.result.pitia)}/mo · DSCR ${ratio(r.result.dscr)} · ${rate(r.option.ratePct)}`,
  }));
  const intro = `Hi ${first}, I put together ${computed.length} loan options for ${s.propertyAddress} so you can compare payment, DSCR and cash to close side by side. Here's the short version. Tap below for the details, and let me know which one you like.`;
  const ok = await sendEmailSafe(
    {
      to: s.investorEmail,
      subject: `Your loan options for ${s.propertyAddress.split(",")[0]}`,
      replyTo: broker.email,
      fromName: `${broker.name} · ${broker.companyName}`,
      html: layout({ broker: pub, heading: "Your loan options are ready", intro, rows, cta: { label: "Compare options", url } }),
      text: textVersion("Your loan options are ready", intro, rows, pub, { label: "Compare options", url }),
    },
    "scenario.share",
  );
  if (ok) await prisma.scenario.update({ where: { id }, data: { status: "SHARED" } });
  revalidatePath(`/dashboard/scenarios/${id}`);
  return { ok, message: ok ? `Sent to ${s.investorEmail}` : "Email failed. Copy the link instead." };
}

export async function archiveScenario(id: string) {
  const { broker } = await requireBroker();
  await prisma.scenario.updateMany({ where: { id, brokerId: broker.id }, data: { status: "ARCHIVED" } });
  revalidatePath("/dashboard/scenarios");
  redirect("/dashboard/scenarios");
}

export async function duplicateScenario(id: string) {
  const { broker } = await requireBroker();
  const s = await prisma.scenario.findFirst({ where: { id, brokerId: broker.id }, include: { options: true } });
  if (!s) return;
  const copy = await prisma.scenario.create({
    data: {
      brokerId: broker.id,
      token: randomToken(20),
      status: "DRAFT",
      origin: s.origin,
      investorName: s.investorName,
      investorEmail: s.investorEmail,
      investorPhone: s.investorPhone,
      propertyAddress: s.propertyAddress,
      loanPurpose: s.loanPurpose,
      propertyValue: s.propertyValue,
      monthlyRent: s.monthlyRent,
      taxesMonthly: s.taxesMonthly,
      insuranceMonthly: s.insuranceMonthly,
      hoaMonthly: s.hoaMonthly,
      note: s.note,
      options: { create: s.options.map(({ id: _id, scenarioId: _sid, ...o }) => o) },
    },
  });
  revalidatePath("/dashboard/scenarios");
  redirect(`/dashboard/scenarios/${copy.id}/edit`);
}
