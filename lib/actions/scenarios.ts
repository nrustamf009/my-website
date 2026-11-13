"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBroker } from "@/lib/auth/session";
import { features, staffBrand } from "@/lib/broker";
import { randomToken } from "@/lib/tokens";
import { emit } from "@/lib/events";
import { sendBrandEmail } from "@/lib/emails";
import { env } from "@/lib/env";
import { expiryFrom, OPTION_LABELS } from "@/lib/scenarios";
import { ScenarioInputSchema, type ScenarioInput } from "@/lib/scenario-schema";

async function ctx() {
  const c = await requireBroker();
  if (!features(c.broker).scenario) throw new Error("Scenario Sheet is not enabled for this account");
  return c;
}

export type SaveResult = { ok: boolean; id?: string; error?: string; fieldErrors?: Record<string, string> };

export async function saveScenario(input: ScenarioInput): Promise<SaveResult> {
  const { db, broker, user } = await ctx();
  const p = ScenarioInputSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: Object.fromEntries(p.error.issues.map((i) => [i.path.join("."), i.message])), error: p.error.issues[0]?.message };
  const d = p.data;
  const recommendedIdx = d.options.findIndex((o) => o.recommended);
  const options = d.options.map((o, i) => ({ ...o, label: OPTION_LABELS[i]!, sortOrder: i, recommended: i === recommendedIdx }));
  const data = {
    investorName: d.investorName,
    investorEmail: d.investorEmail || null,
    investorPhone: d.investorPhone || null,
    mode: d.mode,
    propertyAddress: d.propertyAddress,
    state: d.state,
    propertyType: d.propertyType,
    use: d.use,
    valueCents: d.valueCents,
    currentBalanceCents: d.mode === "PURCHASE" ? null : d.currentBalanceCents,
    rentCents: d.rentCents,
    taxesAnnualCents: d.taxesAnnualCents,
    insuranceAnnualCents: d.insuranceAnnualCents,
    hoaMonthlyCents: d.hoaMonthlyCents,
    ficoBucket: d.ficoBucket,
    note: d.note || null,
  };
  if (d.id) {
    const s = await db.scenario.findFirst({ where: { id: d.id } });
    if (!s) return { ok: false, error: "Scenario not found" };
    await db.scenario.update({ where: { id: s.id }, data: { ...data, options: { deleteMany: {}, create: options } } });
    revalidatePath(`/dashboard/scenarios/${s.id}`);
    return { ok: true, id: s.id };
  }
  const lead = d.leadId ? await db.lead.findFirst({ where: { id: d.leadId } }) : null;
  const s = await db.scenario.create({
    data: {
      ...data,
      brokerId: broker.id,
      ownerUserId: lead?.ownerUserId ?? user?.id ?? broker.primaryUserId ?? "",
      token: randomToken(),
      status: "DRAFT",
      origin: lead ? "LEAD" : "MANUAL",
      leadId: lead?.id ?? null,
      expiresAt: expiryFrom(),
      options: { create: options },
    },
  });
  await emit(db, "scenario.created", "Scenario", s.id, { origin: s.origin }, user?.id);
  revalidatePath("/dashboard/scenarios");
  return { ok: true, id: s.id };
}

/** Mark shared (link copied) and optionally email the investor. Resets the 30-day clock when re-shared after expiry. */
export async function shareScenario(id: string, opts: { email?: boolean } = {}): Promise<{ ok: boolean; url?: string; error?: string; emailed?: boolean }> {
  const { db, broker, user } = await ctx();
  const s = await db.scenario.findFirst({ where: { id }, include: { options: true } });
  if (!s) return { ok: false, error: "Scenario not found" };
  if (s.revokedAt) return { ok: false, error: "This scenario was revoked. Duplicate it to share again." };
  const now = new Date();
  await db.scenario.update({ where: { id }, data: { status: "SHARED", expiresAt: s.expiresAt <= now ? expiryFrom(now) : s.expiresAt } });
  if (s.status !== "SHARED") await emit(db, "scenario.shared", "Scenario", s.id, { emailed: !!opts.email }, user?.id);
  const url = `${env.appUrl}/b/${broker.slug}/s/${s.token}`;
  let emailed = false;
  if (opts.email) {
    if (!s.investorEmail) return { ok: false, error: "Add the investor's email first" };
    const owner = await db.user.findFirst({ where: { id: s.ownerUserId } });
    const brand = await staffBrand(broker, owner ?? user);
    emailed = await sendBrandEmail({
      brand,
      to: s.investorEmail,
      replyTo: brand.lo.email,
      fromName: brand.lo.name,
      subject: `Your loan options for ${s.propertyAddress.split(",")[0]}`,
      heading: `${s.options.length} loan options for ${s.propertyAddress.split(",")[0]}`,
      intro: `Hi ${s.investorName.split(" ")[0]}, here are the options we talked about, side by side: payment, DSCR, cash to close and 5-year cost. Tap the one you like and I'll take it from there.`,
      cta: { label: "Compare your options", url },
      footerNote: "Pricing is valid for 30 days and confirmed when you lock.",
      tag: "scenario.share",
    });
  }
  revalidatePath(`/dashboard/scenarios/${id}`);
  return { ok: true, url, emailed };
}

export async function revokeScenario(id: string) {
  const { db, user } = await ctx();
  const s = await db.scenario.findFirst({ where: { id } });
  if (!s) return { ok: false };
  await db.scenario.update({ where: { id }, data: { revokedAt: new Date(), status: "ARCHIVED" } });
  await emit(db, "scenario.revoked", "Scenario", id, {}, user?.id);
  revalidatePath(`/dashboard/scenarios/${id}`);
  return { ok: true };
}

export async function extendScenario(id: string) {
  const { db } = await ctx();
  const s = await db.scenario.findFirst({ where: { id } });
  if (!s || s.revokedAt) return { ok: false };
  await db.scenario.update({ where: { id }, data: { expiresAt: expiryFrom() } });
  revalidatePath(`/dashboard/scenarios/${id}`);
  return { ok: true };
}

export async function duplicateScenario(id: string) {
  const { db, user } = await ctx();
  const s = await db.scenario.findFirst({ where: { id }, include: { options: true } });
  if (!s) return;
  const { id: _id, token: _t, createdAt: _c, updatedAt: _u, options, firstOpenedAt: _f, lastNotifiedAt: _l, interestedAt: _ia, interestedOptionId: _io, interestQuestion: _iq, revokedAt: _r, ...rest } = s;
  const copy = await db.scenario.create({
    data: { ...rest, token: randomToken(), status: "DRAFT", expiresAt: expiryFrom(), ownerUserId: user?.id ?? s.ownerUserId, options: { create: options.map(({ id: _oid, scenarioId: _sid, ...o }) => o) } },
  });
  await emit(db, "scenario.created", "Scenario", copy.id, { origin: "DUPLICATE" }, user?.id);
  redirect(`/dashboard/scenarios/${copy.id}/edit`);
}
