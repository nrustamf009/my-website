"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { requireBroker } from "@/lib/auth/session";
import { DSCR_BUCKETS, FICO_BUCKETS, MODES, PREPAYS, PRODUCTS, US_STATES, normalizeGrid, type ProgramGrid, type UsState } from "@/lib/dscr";
import { engineContext, parseJson, toPublicBrand, TONE_PRESETS } from "@/lib/broker";
import { parsePctToRatio, parseRateToMilli, parseDollarsToCents } from "@/lib/format";
import { randomToken, slugify } from "@/lib/tokens";
import { queueWebhook, deliverNow, redeliver as redeliverDelivery } from "@/lib/webhooks";
import { sendBrandEmail } from "@/lib/emails";
import { sendBrokerInvite } from "@/lib/invite";
import { emit } from "@/lib/events";

export type SettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string };
const fe = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

/** Onboarding forms include `_step`; after a successful save we advance and redirect. */
async function finish(brokerId: string, formData: FormData, current: number): Promise<SettingsState> {
  revalidatePath("/dashboard", "layout");
  const step = Number(formData.get("_step") ?? 0);
  if (step) {
    if (step >= current) await prisma.broker.update({ where: { id: brokerId }, data: { onboardingStep: step } });
    redirect(step >= 6 ? "/dashboard?welcome=1" : `/onboarding/${step + 1}`);
  }
  return { ok: true };
}

const optionalUrl = z.union([z.literal(""), z.url("Enter a full URL starting with https://")]);

export async function saveBranding(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker } = await requireBroker({ manage: true, onboarding: true });
  const parsed = z
    .object({
      companyName: z.string().trim().min(2, "Enter the company name").max(100),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1F4E79"),
      logoUrl: z.string().max(360_000, "Logo must be under 256 KB").refine((v) => v === "" || /^data:image\/(png|jpeg|svg\+xml);base64,/.test(v) || /^https:\/\//.test(v), "Use a PNG, JPG or SVG"),
      websiteUrl: optionalUrl,
      privacyPolicyUrl: optionalUrl,
      email: z.email("Enter a valid email"),
      phone: z.string().trim().max(30),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fe(parsed.error) };
  const d = parsed.data;
  await prisma.broker.update({ where: { id: broker.id }, data: { ...d, logoUrl: d.logoUrl || null, websiteUrl: d.websiteUrl || null, privacyPolicyUrl: d.privacyPolicyUrl || null, phone: d.phone || null } });
  return finish(broker.id, fd, broker.onboardingStep);
}

export async function saveLicensing(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker, user } = await requireBroker({ manage: true, onboarding: true });
  const parsed = z
    .object({
      companyNmlsId: z.string().trim().regex(/^\d{3,10}$/, "Company NMLS ID should be 3–10 digits"),
      nmlsId: z.string().trim().regex(/^(\d{3,10})?$/, "NMLS ID should be 3–10 digits"),
      title: z.string().trim().max(60),
      loPhone: z.string().trim().max(30),
      headshotUrl: z.string().max(360_000).refine((v) => v === "" || /^data:image\/(png|jpeg);base64,/.test(v) || /^https:\/\//.test(v), "Use a PNG or JPG"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fe(parsed.error) };
  const states = fd.getAll("states").map(String).filter((s) => (US_STATES as string[]).includes(s));
  if (!states.length) return { fieldErrors: { states: "Select at least one licensed state" } };
  await prisma.broker.update({ where: { id: broker.id }, data: { companyNmlsId: parsed.data.companyNmlsId, licensedStates: JSON.stringify(states) } });
  if (user) await prisma.user.update({ where: { id: user.id }, data: { nmlsId: parsed.data.nmlsId || null, title: parsed.data.title || null, phone: parsed.data.loPhone || null, headshotUrl: parsed.data.headshotUrl || null } });
  return finish(broker.id, fd, broker.onboardingStep);
}

export async function saveProgram(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker } = await requireBroker({ manage: true, onboarding: true });
  const g: ProgramGrid = structuredClone(engineContext(broker).grid);
  const num = (k: string) => fd.get(k);
  const errors: Record<string, string> = {};
  const rate = parseRateToMilli(String(num("baseRate") ?? ""));
  if (rate == null || rate < 2_000 || rate > 15_000) errors.baseRate = "Enter a base rate between 2% and 15%";
  else g.baseRateMilli = rate;
  const minD = parsePctToRatio(String(num("minDscr") ?? ""));
  const strongD = parsePctToRatio(String(num("strongDscr") ?? ""));
  // DSCR entered as 1.00 → ratio 10000 (×100 of "percent" parsing means ×10,000 of the decimal).
  if (minD == null || minD < 50 || minD > 200) errors.minDscr = "Enter a DSCR like 1.00";
  else g.minDscrRatio = minD * 100;
  if (strongD == null || strongD < 50 || strongD > 300) errors.strongDscr = "Enter a DSCR like 1.20";
  else g.strongDscrRatio = strongD * 100;
  const fico = Number(num("ficoFloor"));
  if (!Number.isInteger(fico) || fico < 500 || fico > 800) errors.ficoFloor = "Enter a score like 660";
  else g.ficoFloor = fico;
  const reserves = Number(num("reservesMonths"));
  if (!Number.isInteger(reserves) || reserves < 0 || reserves > 24) errors.reservesMonths = "0–24 months";
  else g.reservesMonths = reserves;
  g.subOneDscrEnabled = fd.get("subOneDscrEnabled") === "on";
  const minLoan = parseDollarsToCents(String(num("minLoan") ?? ""));
  const maxLoan = parseDollarsToCents(String(num("maxLoan") ?? ""));
  if (minLoan == null || maxLoan == null || minLoan >= maxLoan) errors.minLoan = "Min loan must be below max loan";
  else Object.assign(g, { minLoanCents: minLoan, maxLoanCents: maxLoan });
  const ccP = parsePctToRatio(String(num("closingPurchase") ?? ""));
  const ccR = parsePctToRatio(String(num("closingRefi") ?? ""));
  if (ccP != null) g.closingCostRatio.purchase = ccP;
  if (ccR != null) g.closingCostRatio.refi = ccR;
  const buydown = parseRateToMilli(String(num("buydown") ?? ""));
  if (buydown != null) g.buydownMilliPerPoint = buydown;
  // Full grid (settings page only): LTV cells and rate adjustments.
  if (fd.has("ltv_PURCHASE_740+_>=1.20")) {
    for (const m of MODES) for (const f of FICO_BUCKETS) for (const d of DSCR_BUCKETS) {
      const raw = String(fd.get(`ltv_${m}_${f}_${d}`) ?? "").trim();
      g.maxLtvRatio[m][f][d] = raw === "" || raw === "0" ? null : parsePctToRatio(raw);
    }
    for (const f of FICO_BUCKETS) g.rateAdjMilli.fico[f] = parseRateToMilli(String(fd.get(`adj_fico_${f}`) ?? "0")) ?? 0;
    for (const d of DSCR_BUCKETS) g.rateAdjMilli.dscr[d] = parseRateToMilli(String(fd.get(`adj_dscr_${d}`) ?? "0")) ?? 0;
    for (const p of PRODUCTS) g.rateAdjMilli.product[p] = signedMilli(fd.get(`adj_product_${p}`));
    for (const p of PREPAYS) g.rateAdjMilli.prepay[p] = signedMilli(fd.get(`adj_prepay_${p}`));
    for (const m of MODES) g.rateAdjMilli.mode[m] = signedMilli(fd.get(`adj_mode_${m}`));
  } else if (fd.has("ltvPurchase")) {
    // Onboarding shortcut: top-tier purchase and cash-out caps; lower tiers step down by 5 points.
    const p = parsePctToRatio(String(fd.get("ltvPurchase")));
    const c = parsePctToRatio(String(fd.get("ltvCashOut")));
    if (p && c) {
      for (const [m, top] of [["PURCHASE", p], ["RATE_TERM", p], ["CASH_OUT", c]] as const) {
        const steps: Record<string, number | null> = { "740+": top, "700-739": top, "680-699": top - 500, "660-679": top - 1000, "<660": null };
        for (const f of FICO_BUCKETS) for (const d of DSCR_BUCKETS) {
          const base = steps[f] ?? null;
          g.maxLtvRatio[m][f][d] = d === "<0.75" || base === null ? null : d === "0.75-0.99" ? Math.min(base, 7000) : base;
        }
      }
    }
  }
  if (Object.keys(errors).length) return { fieldErrors: errors };
  await prisma.broker.update({ where: { id: broker.id }, data: { programGrid: JSON.stringify(normalizeGrid(g)) } });
  return finish(broker.id, fd, broker.onboardingStep);
}

function signedMilli(v: FormDataEntryValue | null): number {
  const s = String(v ?? "0").trim();
  const neg = s.startsWith("-") || s.startsWith("−");
  const m = parseRateToMilli(s.replace(/^[-−]/, "")) ?? 0;
  return neg ? -m : m;
}

export async function saveStateOverrides(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker } = await requireBroker({ manage: true });
  const out: Record<string, { taxRatio: number; insuranceRatio: number }> = {};
  for (const s of US_STATES) {
    const tax = String(fd.get(`tax_${s}`) ?? "").trim();
    const ins = String(fd.get(`ins_${s}`) ?? "").trim();
    if (tax || ins) {
      const base = engineContext({ programGrid: "{}", stateOverrides: "{}" }).stateDefaults[s as UsState];
      out[s] = { taxRatio: tax ? parsePctToRatio(tax) ?? base.taxRatio : base.taxRatio, insuranceRatio: ins ? parsePctToRatio(ins) ?? base.insuranceRatio : base.insuranceRatio };
    }
  }
  await prisma.broker.update({ where: { id: broker.id }, data: { stateOverrides: JSON.stringify(out) } });
  revalidatePath("/dashboard/settings/states");
  return { ok: true };
}

export async function saveNotifications(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker } = await requireBroker({ manage: true, onboarding: true });
  const emails = String(fd.get("notificationEmails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length || emails.some((e) => !z.email().safeParse(e).success)) return { fieldErrors: { notificationEmails: "Enter one or more valid emails, separated by commas" } };
  const tone = String(fd.get("tonePreset") ?? "FRIENDLY");
  if (![...Object.keys(TONE_PRESETS), "CUSTOM"].includes(tone)) return { fieldErrors: { tonePreset: "Pick a tone" } };
  await prisma.broker.update({ where: { id: broker.id }, data: { notificationEmails: JSON.stringify(emails), tonePreset: tone, toneCustom: tone === "CUSTOM" ? String(fd.get("toneCustom") ?? "").slice(0, 300) || null : null } });
  return finish(broker.id, fd, broker.onboardingStep);
}

export async function sendTestNotification(): Promise<SettingsState> {
  const { broker, user, db } = await requireBroker({ manage: true, onboarding: true });
  const disc = broker.currentDisclaimerId ? await db.disclaimerVersion.findFirst({ where: { id: broker.currentDisclaimerId } }) : null;
  const to = parseJson<string[]>(broker.notificationEmails, [broker.email]);
  const ok = await sendBrandEmail({
    brand: toPublicBrand(broker, user, disc),
    to,
    subject: "Test notification from your DSCR Investor Toolkit",
    heading: "Notifications are working",
    intro: "This is what lead alerts, scenario-open alerts and weekly ROI reports will look like.",
    internal: true,
    tag: "settings.test_email",
  });
  return ok ? { ok: true, message: `Sent to ${to.join(", ")}` } : { error: "Couldn't send. Check the addresses." };
}

export async function saveWebhook(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker } = await requireBroker({ manage: true, onboarding: true });
  const url = String(fd.get("webhookUrl") ?? "").trim();
  if (url && !/^https?:\/\/[^\s]+$/.test(url)) return { fieldErrors: { webhookUrl: "Enter a full URL, e.g. https://hooks.zapier.com/…" } };
  await prisma.broker.update({ where: { id: broker.id }, data: { webhookUrl: url || null } });
  return finish(broker.id, fd, broker.onboardingStep);
}

export async function sendTestWebhook(): Promise<SettingsState> {
  const { broker, db } = await requireBroker({ manage: true, onboarding: true });
  if (!broker.webhookUrl) return { error: "Save a webhook URL first." };
  const id = await queueWebhook(db, broker, "test", { message: "Test event from DSCR Investor Toolkit", sentAt: new Date().toISOString() });
  await deliverNow(id, broker.id);
  await emit(db, "webhook.test", "Broker", broker.id);
  const d = id ? await db.webhookDelivery.findFirst({ where: { id } }) : null;
  revalidatePath("/dashboard/settings/integrations");
  return d?.status === "SUCCESS" ? { ok: true, message: `Delivered (HTTP ${d.lastHttpStatus})` } : { error: `Not delivered${d?.lastHttpStatus ? ` (HTTP ${d.lastHttpStatus})` : d?.lastError ? ` (${d.lastError})` : ""}. Retries are scheduled automatically.` };
}

export async function redeliverAction(id: string) {
  const { db } = await requireBroker({ manage: true });
  await redeliverDelivery(db, id);
  revalidatePath("/dashboard/settings/integrations");
}

export async function rotateWebhookSecret() {
  const { broker } = await requireBroker({ manage: true });
  await prisma.broker.update({ where: { id: broker.id }, data: { webhookSecret: `whsec_${randomToken(28)}` } });
  revalidatePath("/dashboard/settings/integrations");
}

export async function finishOnboarding(fd: FormData) {
  const { broker } = await requireBroker({ manage: true, onboarding: true });
  await finish(broker.id, fd, broker.onboardingStep);
}

export async function publishDisclaimer(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker, db } = await requireBroker({ manage: true });
  const text = String(fd.get("text") ?? "").trim();
  if (text.length < 80) return { fieldErrors: { text: "The disclaimer must say it's an estimate, not a commitment to lend, subject to change, and not all applicants qualify." } };
  if (!/estimate/i.test(text) || !/not a commitment to lend/i.test(text)) return { fieldErrors: { text: "Keep the words “estimate” and “not a commitment to lend”." } };
  const last = await db.disclaimerVersion.findFirst({ orderBy: { version: "desc" } });
  const v = await db.disclaimerVersion.create({ data: { brokerId: broker.id, version: (last?.version ?? 0) + 1, text } });
  await prisma.broker.update({ where: { id: broker.id }, data: { currentDisclaimerId: v.id } });
  revalidatePath("/dashboard/settings/compliance");
  return { ok: true, message: `Published v${v.version}. New leads and PDFs record this version.` };
}

export async function inviteTeammate(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const { broker } = await requireBroker({ manage: true });
  const parsed = z.object({ name: z.string().trim().min(2, "Enter a name"), email: z.email("Enter a valid email"), nmlsId: z.string().trim().regex(/^(\d{3,10})?$/, "3–10 digits") }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fe(parsed.error) };
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return { fieldErrors: { email: "A user with this email already exists" } };
  let slug = slugify(parsed.data.name.split(" ")[0] ?? "lo");
  if (await prisma.user.findFirst({ where: { brokerId: broker.id, slug } })) slug = `${slug}-${randomToken(3).toLowerCase()}`;
  await prisma.user.create({ data: { email, name: parsed.data.name, nmlsId: parsed.data.nmlsId || null, role: "LO", brokerId: broker.id, slug } });
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: broker.agencyId } });
  await sendBrokerInvite({ to: email, name: parsed.data.name, agencyName: agency.name, companyName: broker.companyName, slug: broker.slug });
  revalidatePath("/dashboard/settings/team");
  return { ok: true, message: `Invited ${email}` };
}

export async function setUserActive(userId: string, active: boolean) {
  const { broker, user } = await requireBroker({ manage: true });
  if (user?.id === userId) return;
  await prisma.user.updateMany({ where: { id: userId, brokerId: broker.id }, data: { active } });
  revalidatePath("/dashboard/settings/team");
}
