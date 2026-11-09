"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { requireBroker } from "@/lib/auth/session";
import { FICO_RANGES } from "@/lib/dscr";
import { fieldErrors } from "@/lib/validation";
import { dispatchWebhook, redeliverWebhook } from "@/lib/webhooks";
import { randomToken } from "@/lib/tokens";

export type SettingsState = { ok?: boolean; fieldErrors?: Record<string, string>; error?: string };

const pctField = (label: string, max: number) => z.coerce.number({ error: `Enter ${label}` }).min(0, `${label} can't be negative`).max(max, `${label} looks too high`);

const SettingsSchema = z.object({
  // Branding & contact
  name: z.string().trim().min(2, "Enter your name").max(100),
  title: z.string().trim().min(2).max(60),
  companyName: z.string().trim().min(2).max(100),
  nmlsId: z.string().trim().regex(/^\d{3,10}$/, "NMLS ID should be 3–10 digits"),
  companyNmlsId: z.string().trim().regex(/^(\d{3,10})?$/, "NMLS ID should be 3–10 digits"),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().max(30),
  website: z.union([z.literal(""), z.url("Enter a full URL starting with https://")]),
  licensedStates: z.string().trim().max(200),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1F4E79"),
  logoUrl: z
    .string()
    .max(360_000, "Logo must be under 256 KB")
    .refine((v) => v === "" || /^data:image\/(png|jpeg|svg\+xml);base64,/.test(v) || /^https:\/\//.test(v), "Use a PNG, JPG or SVG"),
  disclaimerText: z.string().trim().min(40, "The disclaimer should be at least a sentence or two").max(2000),
  // Notifications & integrations
  notificationEmail: z.email("Enter a valid email"),
  webhookUrl: z.union([z.literal(""), z.url("Enter a full https:// URL")]).refine((v) => v === "" || /^https?:\/\//.test(v), "Use an http(s) URL"),
  messageTone: z.string().trim().min(10, "Describe your tone in a sentence").max(300),
  // DSCR defaults
  minDscr: z.coerce.number().min(0.5, "Min DSCR must be at least 0.50").max(2, "Min DSCR above 2.00 is unusual"),
  maxLtv: pctField("Max LTV", 90),
  defaultRate: pctField("Rate", 20),
  taxRatePct: pctField("Tax rate", 5),
  insuranceRatePct: pctField("Insurance rate", 5),
  borderlineBand: z.coerce.number().min(0).max(0.5),
  // Money List
  rateDropThreshold: z.coerce.number().min(0.125, "Use at least 0.125 points").max(5),
  prepayWindowDays: z.coerce.number().int().min(0).max(365),
  seasoningMonths: z.string().regex(/^\s*\d{1,2}(\s*,\s*\d{1,2})*\s*$/, "Use months like 6, 12"),
  digestEnabled: z.boolean(),
});

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { broker } = await requireBroker();
  const raw = Object.fromEntries(formData);
  const parsed = SettingsSchema.safeParse({ ...raw, digestEnabled: formData.get("digestEnabled") === "on" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const caps = FICO_RANGES.map((range) => ({ range, maxLtv: Math.min(0.9, Math.max(0, Number(formData.get(`cap_${range}`) ?? 0) / 100)) }));
  await prisma.broker.update({
    where: { id: broker.id },
    data: {
      ...d,
      companyNmlsId: d.companyNmlsId || null,
      phone: d.phone || null,
      website: d.website || null,
      licensedStates: d.licensedStates || null,
      logoUrl: d.logoUrl || null,
      webhookUrl: d.webhookUrl || null,
      maxLtv: d.maxLtv / 100,
      seasoningMonths: JSON.stringify(d.seasoningMonths.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0)),
      ficoLtvCaps: JSON.stringify(caps),
    },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function sendTestWebhook(): Promise<{ ok: boolean; message: string }> {
  const { broker } = await requireBroker();
  if (!broker.webhookUrl) return { ok: false, message: "Save a webhook URL first." };
  const r = await dispatchWebhook(broker, "test", { message: "Test event from DSCR Investor Toolkit", sentAt: new Date().toISOString() });
  revalidatePath("/dashboard/settings");
  return { ok: r.ok, message: r.ok ? `Delivered (HTTP ${r.status})` : `Failed${r.status ? ` (HTTP ${r.status})` : " (no response)"}` };
}

export async function redeliver(id: string) {
  const { broker } = await requireBroker();
  await redeliverWebhook(id, broker.id);
  revalidatePath("/dashboard/settings");
}

export async function rotateWebhookSecret() {
  const { broker } = await requireBroker();
  await prisma.broker.update({ where: { id: broker.id }, data: { webhookSecret: `whsec_${randomToken(24)}` } });
  revalidatePath("/dashboard/settings");
}
