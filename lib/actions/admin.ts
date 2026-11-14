"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { THEME_IDS, THEMES, checkAccent, isThemeId } from "@design";
import { prisma, forBroker } from "@/lib/db";
import { getSession, requireAdmin, signImpersonation, verifyImpersonation, IMPERSONATE_COOKIE } from "@/lib/auth/session";
import { randomToken, slugify } from "@/lib/tokens";
import { DEFAULT_DISCLAIMER } from "@/lib/compliance/disclaimers";
import { DEFAULT_GRID } from "@/lib/dscr";
import { ALL_FEATURES, type FeatureKey } from "@/lib/broker";
import { sendBrokerInvite } from "@/lib/invite";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };
const fe = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

async function audit(agencyId: string, action: string, targetBrokerId: string | null, meta: Record<string, unknown> = {}) {
  const session = await getSession();
  await prisma.auditLog.create({ data: { agencyId, actorUserId: session?.user.id ?? "system", action, targetBrokerId, meta: JSON.stringify(meta) } });
}

export async function impersonate(brokerId: string) {
  const { agency } = await requireAdmin();
  const broker = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!broker) throw new Error("Broker not found");
  (await cookies()).set(IMPERSONATE_COOKIE, signImpersonation(broker.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
  await audit(agency.id, "IMPERSONATE_START", broker.id, { company: broker.companyName });
  redirect("/dashboard");
}

export async function stopImpersonating() {
  const session = await getSession();
  const jar = await cookies();
  const brokerId = verifyImpersonation(jar.get(IMPERSONATE_COOKIE)?.value);
  jar.delete(IMPERSONATE_COOKIE);
  if (session?.user.agencyId && brokerId) await audit(session.user.agencyId, "IMPERSONATE_STOP", brokerId);
  redirect("/admin");
}

const BrokerInput = z.object({
  companyName: z.string().trim().min(2, "Enter the company name"),
  slug: z.string().trim().optional(),
  companyNmlsId: z.string().trim().regex(/^\d{3,10}$/, "Company NMLS ID should be 3–10 digits"),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color (for example, the one from your brand guide)"),
  theme: z.enum(THEME_IDS).optional(),
  licensedStates: z.string().trim().optional(),
  loName: z.string().trim().min(2, "Enter the loan officer's name"),
  loEmail: z.email("Enter a valid login email"),
  loNmlsId: z.string().trim().regex(/^(\d{3,10})?$/, "NMLS ID should be 3–10 digits"),
});

export async function createBroker(_prev: FormState, formData: FormData): Promise<FormState> {
  const { agency } = await requireAdmin();
  const parsed = BrokerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fe(parsed.error) };
  const d = parsed.data;
  const slug = slugify(d.slug || d.companyName);
  if (!slug) return { fieldErrors: { slug: "Choose a URL slug" } };
  if (await prisma.broker.findUnique({ where: { slug } })) return { fieldErrors: { slug: "That URL slug is taken" } };
  const loEmail = d.loEmail.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: loEmail } })) return { fieldErrors: { loEmail: "A user with this email already exists" } };
  const theme = d.theme ?? (isThemeId(agency.defaultTheme) ? agency.defaultTheme : "maison");
  const acc = checkAccent(theme, d.accentColor);
  if (!acc.ok) return { fieldErrors: { accentColor: acc.reason ?? "Pick a color with more contrast." } };
  const states = (d.licensedStates ?? "").toUpperCase().split(/[\s,]+/).filter((s) => /^[A-Z]{2}$/.test(s));

  const broker = await prisma.broker.create({
    data: {
      agencyId: agency.id,
      slug,
      status: "TRIAL",
      features: JSON.stringify(ALL_FEATURES),
      companyName: d.companyName,
      companyNmlsId: d.companyNmlsId,
      email: d.email,
      phone: d.phone || null,
      theme,
      accentColor: d.accentColor,
      licensedStates: JSON.stringify(states),
      notificationEmails: JSON.stringify([loEmail]),
      webhookSecret: `whsec_${randomToken(28)}`,
      programGrid: JSON.stringify(DEFAULT_GRID),
    },
  });
  const user = await prisma.user.create({ data: { email: loEmail, name: d.loName, role: "BROKER_ADMIN", brokerId: broker.id, nmlsId: d.loNmlsId || null, slug: slugify(d.loName.split(" ")[0] ?? "lo"), phone: d.phone || null } });
  const disc = await forBroker(broker.id).disclaimerVersion.create({ data: { brokerId: broker.id, version: 1, text: DEFAULT_DISCLAIMER } });
  await prisma.broker.update({ where: { id: broker.id }, data: { primaryUserId: user.id, currentDisclaimerId: disc.id } });
  await audit(agency.id, "BROKER_CREATE", broker.id, { slug });
  await sendBrokerInvite({ to: loEmail, name: d.loName, agencyName: agency.name, companyName: d.companyName, slug });
  revalidatePath("/admin");
  redirect(`/admin/brokers/${broker.id}?created=1`);
}

export async function setBrokerStatus(brokerId: string, status: "TRIAL" | "ACTIVE" | "SUSPENDED") {
  const { agency } = await requireAdmin();
  const b = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!b) return;
  await prisma.broker.update({ where: { id: b.id }, data: { status } });
  await audit(agency.id, "BROKER_STATUS", b.id, { from: b.status, to: status });
  revalidatePath(`/admin/brokers/${b.id}`);
}

export async function setBrokerFeatures(brokerId: string, formData: FormData) {
  const { agency } = await requireAdmin();
  const b = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!b) return;
  const next = Object.fromEntries((Object.keys(ALL_FEATURES) as FeatureKey[]).map((k) => [k, formData.get(k) === "on"]));
  await prisma.broker.update({ where: { id: b.id }, data: { features: JSON.stringify(next) } });
  await audit(agency.id, "BROKER_FEATURES", b.id, next);
  revalidatePath(`/admin/brokers/${b.id}`);
}

export async function addBrokerUser(brokerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { agency } = await requireAdmin();
  const broker = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!broker) return { error: "Broker not found" };
  const parsed = z.object({ email: z.email("Enter a valid email"), name: z.string().trim().min(2, "Enter a name"), nmlsId: z.string().trim().regex(/^(\d{3,10})?$/, "3–10 digits"), role: z.enum(["LO", "BROKER_ADMIN"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fe(parsed.error) };
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return { fieldErrors: { email: "A user with this email already exists" } };
  let slug = slugify(parsed.data.name.split(" ")[0] ?? "lo");
  if (await prisma.user.findFirst({ where: { brokerId: broker.id, slug } })) slug = `${slug}-${randomToken(3).toLowerCase()}`;
  await prisma.user.create({ data: { email, name: parsed.data.name, role: parsed.data.role, brokerId: broker.id, nmlsId: parsed.data.nmlsId || null, slug } });
  await audit(agency.id, "USER_INVITE", broker.id, { role: parsed.data.role });
  await sendBrokerInvite({ to: email, name: parsed.data.name, agencyName: agency.name, companyName: broker.companyName, slug: broker.slug });
  revalidatePath(`/admin/brokers/${broker.id}`);
  return { ok: true };
}

export async function resendInvite(userId: string): Promise<{ ok: boolean }> {
  const { agency } = await requireAdmin();
  const user = await prisma.user.findFirst({ where: { id: userId, broker: { agencyId: agency.id } }, include: { broker: true } });
  if (!user?.broker) return { ok: false };
  return { ok: await sendBrokerInvite({ to: user.email, name: user.name, agencyName: agency.name, companyName: user.broker.companyName, slug: user.broker.slug }) };
}

/** Agency default theme for new brokers. */
export async function setAgencyDefaultTheme(formData: FormData) {
  const { agency } = await requireAdmin();
  const theme = String(formData.get("theme") ?? "");
  if (!isThemeId(theme)) return;
  await prisma.agency.update({ where: { id: agency.id }, data: { defaultTheme: theme } });
  await audit(agency.id, "AGENCY_DEFAULT_THEME", null, { theme });
  revalidatePath("/admin");
}

/** Agency override of a broker's theme (accent snaps to the theme default if it can't reach AA there). */
export async function setBrokerTheme(brokerId: string, formData: FormData) {
  const { agency } = await requireAdmin();
  const theme = String(formData.get("theme") ?? "");
  const b = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!b || !isThemeId(theme)) return;
  const accent = checkAccent(theme, b.accentColor).ok ? b.accentColor : THEMES[theme].defaultAccent;
  await prisma.broker.update({ where: { id: b.id }, data: { theme, accentColor: accent } });
  await audit(agency.id, "BROKER_THEME", b.id, { from: b.theme, to: theme, accent });
  revalidatePath(`/admin/brokers/${b.id}`);
}
