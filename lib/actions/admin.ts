"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { requireAdmin, signImpersonation, IMPERSONATE_COOKIE } from "@/lib/auth/session";
import { randomToken, slugify } from "@/lib/tokens";
import { DEFAULT_DISCLAIMER } from "@/lib/broker";
import { DEFAULT_FICO_LTV_CAPS } from "@/lib/dscr";

export async function impersonate(brokerId: string) {
  const { agency } = await requireAdmin();
  const broker = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!broker) throw new Error("Broker not found");
  (await cookies()).set(IMPERSONATE_COOKIE, signImpersonation(broker.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
  redirect("/dashboard");
}

const BrokerInput = z.object({
  name: z.string().trim().min(2, "Enter the loan officer's name"),
  companyName: z.string().trim().min(2, "Enter the company name"),
  slug: z.string().trim().optional(),
  nmlsId: z.string().trim().regex(/^\d{3,10}$/, "NMLS ID should be 3–10 digits"),
  companyNmlsId: z.string().trim().optional(),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1F4E79"),
  loginEmail: z.email("Enter a valid login email"),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

export async function createBroker(_prev: FormState, formData: FormData): Promise<FormState> {
  const { agency } = await requireAdmin();
  const parsed = BrokerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const d = parsed.data;
  const slug = slugify(d.slug || d.companyName);
  if (!slug) return { fieldErrors: { slug: "Choose a URL slug" } };
  if (await prisma.broker.findUnique({ where: { slug } })) return { fieldErrors: { slug: "That URL slug is taken" } };
  const loginEmail = d.loginEmail.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: loginEmail } })) return { fieldErrors: { loginEmail: "A user with this email already exists" } };

  const broker = await prisma.broker.create({
    data: {
      agencyId: agency.id,
      slug,
      name: d.name,
      companyName: d.companyName,
      nmlsId: d.nmlsId,
      companyNmlsId: d.companyNmlsId || null,
      email: d.email,
      phone: d.phone || null,
      accentColor: d.accentColor,
      notificationEmail: d.email,
      webhookSecret: `whsec_${randomToken(24)}`,
      disclaimerText: DEFAULT_DISCLAIMER,
      ficoLtvCaps: JSON.stringify(DEFAULT_FICO_LTV_CAPS),
      users: { create: { email: loginEmail, name: d.name, role: "BROKER" } },
    },
  });
  revalidatePath("/admin");
  redirect(`/admin/brokers/${broker.id}?created=1`);
}

export async function updateBrokerBasics(brokerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { agency } = await requireAdmin();
  const broker = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!broker) return { error: "Broker not found" };
  const parsed = BrokerInput.omit({ loginEmail: true, slug: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = parsed.data;
  await prisma.broker.update({
    where: { id: broker.id },
    data: { name: d.name, companyName: d.companyName, nmlsId: d.nmlsId, companyNmlsId: d.companyNmlsId || null, email: d.email, phone: d.phone || null, accentColor: d.accentColor, active: formData.get("active") === "on" },
  });
  revalidatePath(`/admin/brokers/${broker.id}`);
  return { ok: true };
}

export async function addBrokerUser(brokerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { agency } = await requireAdmin();
  const broker = await prisma.broker.findFirst({ where: { id: brokerId, agencyId: agency.id } });
  if (!broker) return { error: "Broker not found" };
  const email = z.email().safeParse(String(formData.get("email") ?? "").toLowerCase());
  if (!email.success) return { fieldErrors: { email: "Enter a valid email" } };
  if (await prisma.user.findUnique({ where: { email: email.data } })) return { fieldErrors: { email: "A user with this email already exists" } };
  await prisma.user.create({ data: { email: email.data, name: String(formData.get("name") || "") || null, role: "BROKER", brokerId: broker.id } });
  revalidatePath(`/admin/brokers/${broker.id}`);
  return { ok: true };
}
