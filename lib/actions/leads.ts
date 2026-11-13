"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { requireBroker } from "@/lib/auth/session";
import { emit } from "@/lib/events";
import { dispatchWebhook } from "@/lib/webhooks";
import { e164 } from "@/lib/check/form";
import { env } from "@/lib/env";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads-meta";

async function lead(id: string) {
  const c = await requireBroker();
  const l = await c.db.lead.findFirst({ where: { id } });
  if (!l) throw new Error("Lead not found");
  return { ...c, l };
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) return { ok: false };
  const { db, broker, user, l } = await lead(id);
  if (l.status === status) return { ok: true };
  const u = await db.lead.update({ where: { id }, data: { status } });
  await emit(db, "lead.status_changed", "Lead", id, { from: l.status, to: status }, user?.id);
  await dispatchWebhook(db, broker, "lead.updated", {
    lead: { id: u.id, source: u.source, status: u.status, previousStatus: l.status, name: u.name, email: u.email, phone: u.phone, createdAt: u.createdAt.toISOString(), submissions: u.submissions },
    changedBy: user?.email ?? null,
    dashboardUrl: `${env.appUrl}/dashboard/leads/${u.id}`,
  });
  revalidatePath(`/dashboard/leads/${id}`);
  revalidatePath("/dashboard/leads");
  return { ok: true };
}

export async function setLeadOwner(id: string, ownerUserId: string) {
  const { db, user } = await lead(id);
  const owner = await db.user.findFirst({ where: { id: ownerUserId, active: true } });
  if (!owner) return { ok: false };
  await db.lead.update({ where: { id }, data: { ownerUserId: owner.id } });
  await emit(db, "lead.status_changed", "Lead", id, { owner: owner.name }, user?.id);
  revalidatePath(`/dashboard/leads/${id}`);
  return { ok: true };
}

export async function saveLeadNotes(id: string, notes: string) {
  const { db } = await lead(id);
  await db.lead.update({ where: { id }, data: { notes: notes.trim().slice(0, 4_000) || null } });
  revalidatePath(`/dashboard/leads/${id}`);
  return { ok: true };
}

/**
 * CCPA/consumer deletion: removes the lead, its consents and its personal data.
 * Events keep only non-identifying metadata; scenarios built for this person are anonymized.
 */
export async function deleteLeadPersonalData(id: string) {
  const { db, user, canManage, l } = await lead(id);
  if (!canManage) throw new Error("Only a broker admin can delete lead data");
  await db.scenario.updateMany({ where: { OR: [{ leadId: l.id }, { investorEmail: l.email }] }, data: { investorName: "Deleted contact", investorEmail: null, investorPhone: null, leadId: null, interestQuestion: null } });
  await db.lead.delete({ where: { id: l.id } });
  await emit(db, "lead.deleted", "Lead", l.id, { reason: "consumer_request" }, user?.id);
  revalidatePath("/dashboard/leads");
  redirect("/dashboard/leads?deleted=1");
}

const ManualLead = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().max(30),
  propertyAddress: z.string().trim().max(200),
  notes: z.string().trim().max(2_000),
});

export type ManualLeadState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export async function addManualLead(_p: ManualLeadState, fd: FormData): Promise<ManualLeadState> {
  const { db, broker, user } = await requireBroker();
  const p = ManualLead.safeParse(Object.fromEntries(fd));
  if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = p.data;
  const email = d.email.toLowerCase();
  if (await db.lead.findFirst({ where: { email } })) return { error: "A lead with this email already exists." };
  const l = await db.lead.create({ data: { brokerId: broker.id, source: "MANUAL", name: d.name, email, phone: d.phone || null, phoneE164: e164(d.phone), propertyAddress: d.propertyAddress || null, notes: d.notes || null, ownerUserId: user?.id ?? broker.primaryUserId } });
  await emit(db, "lead.created", "Lead", l.id, { source: "MANUAL" }, user?.id);
  redirect(`/dashboard/leads/${l.id}`);
}
