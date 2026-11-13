"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, features, staffBrand } from "@/lib/broker";
import { estimateEscrow, gridRate, isUsState, PROPERTY_TYPES, type UsState } from "@/lib/dscr";
import { parseDollarsToCents, parseRateToMilli } from "@/lib/format";
import { normalizeAddress } from "@/lib/providers/address";
import { lookupProperty } from "@/lib/providers/property";
import { randomToken } from "@/lib/tokens";
import { emit } from "@/lib/events";
import { realtorStats } from "@/lib/snapshots";
import { sendBrandEmail } from "@/lib/emails";
import { env } from "@/lib/env";

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };
const fe = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

async function ctx() {
  const c = await requireBroker();
  if (!features(c.broker).snapshot) throw new Error("Listing Snapshot is not enabled for this account");
  return c;
}

const image = z.string().max(700_000, "Image must be under 500 KB").refine((v) => v === "" || /^data:image\/(png|jpeg);base64,/.test(v) || /^https:\/\//.test(v), "Use a PNG or JPG");

const RealtorSchema = z.object({
  name: z.string().trim().min(2, "Enter the agent's name").max(80),
  brokerage: z.string().trim().min(2, "Enter the brokerage").max(100),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  headshotUrl: image,
  logoUrl: image,
});

export async function saveRealtor(_p: FormState, fd: FormData): Promise<FormState> {
  const { db, broker } = await ctx();
  const parsed = RealtorSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fe(parsed.error) };
  const d = parsed.data;
  const data = { name: d.name, brokerage: d.brokerage, phone: d.phone || null, email: d.email || null, headshotUrl: d.headshotUrl || null, logoUrl: d.logoUrl || null };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const r = await db.realtor.findFirst({ where: { id } });
    if (!r) return { error: "Realtor not found" };
    await db.realtor.update({ where: { id }, data });
  } else await db.realtor.create({ data: { ...data, brokerId: broker.id } });
  revalidatePath("/dashboard/snapshots");
  return { ok: true };
}

const SnapshotSchema = z.object({
  address: z.string().trim().min(8, "Enter the full property address").max(200).refine((v) => /\d/.test(v), "Include the street number"),
  state: z.string().refine((v) => isUsState(v), "Choose the state"),
  propertyType: z.enum(PROPERTY_TYPES as [string, ...string[]]),
  listPrice: z.string().min(1, "Enter the list price"),
  rent: z.string().optional(),
  taxes: z.string().optional(),
  insurance: z.string().optional(),
  hoa: z.string().optional(),
  rate: z.string().optional(),
  photoUrl: z.string().max(1_400_000, "Photo must be under 1 MB").refine((v) => v === "" || /^data:image\/(png|jpeg);base64,/.test(v) || /^https:\/\//.test(v), "Use a PNG or JPG"),
  template: z.enum(["CLASSIC", "MODERN"]),
  realtorId: z.string().optional(),
  newRealtorName: z.string().optional(),
  newRealtorBrokerage: z.string().optional(),
  newRealtorEmail: z.string().optional(),
  newRealtorPhone: z.string().optional(),
});

export async function createSnapshot(_p: FormState, fd: FormData): Promise<FormState> {
  const { db, broker, user } = await ctx();
  const raw = Object.fromEntries(fd) as Record<string, string>;
  if (!raw.state) raw.state = normalizeAddress(raw.address ?? "").state ?? "";
  const parsed = SnapshotSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fe(parsed.error) };
  const d = parsed.data;
  const errors: Record<string, string> = {};
  const listPriceCents = parseDollarsToCents(d.listPrice);
  if (!listPriceCents || listPriceCents < 5_000_000 || listPriceCents > 1_000_000_000) errors.listPrice = "Enter a list price between $50,000 and $10,000,000";
  const money = (k: "rent" | "taxes" | "insurance" | "hoa") => {
    const v = d[k]?.trim();
    if (!v) return null;
    const c = parseDollarsToCents(v);
    if (c == null || c < 0) errors[k] = "Enter a dollar amount";
    return c;
  };
  let rentCents = money("rent");
  const taxesAnnual = money("taxes");
  const insAnnual = money("insurance");
  const hoaCents = money("hoa") ?? 0;
  let rateMilli = d.rate?.trim() ? parseRateToMilli(d.rate) : null;
  if (d.rate?.trim() && (rateMilli == null || rateMilli < 2_000 || rateMilli > 15_000)) errors.rate = "Enter a rate between 2% and 15%";

  // Realtor: existing or created inline.
  let realtorId = d.realtorId || "";
  if (!realtorId) {
    const r = RealtorSchema.safeParse({ name: d.newRealtorName ?? "", brokerage: d.newRealtorBrokerage ?? "", phone: d.newRealtorPhone ?? "", email: d.newRealtorEmail ?? "", headshotUrl: "", logoUrl: "" });
    if (!r.success) {
      const e = fe(r.error);
      if (e.name) errors.newRealtorName = e.name;
      if (e.brokerage) errors.newRealtorBrokerage = e.brokerage;
      if (e.email) errors.newRealtorEmail = e.email;
    }
  } else if (!(await db.realtor.findFirst({ where: { id: realtorId } }))) errors.realtorId = "Choose a realtor";
  if (Object.keys(errors).length) return { fieldErrors: errors };

  const state = d.state as UsState;
  const ctxE = engineContext(broker);
  let rentSource = "MANUAL";
  let taxesAnnualCents = taxesAnnual;
  if (rentCents == null || taxesAnnualCents == null) {
    const look = await lookupProperty(d.address, { priceCents: listPriceCents! });
    if (rentCents == null && look?.rentCents) {
      rentCents = look.rentCents;
      rentSource = "PROVIDER";
    }
    if (taxesAnnualCents == null && look?.taxesAnnualCents) taxesAnnualCents = look.taxesAnnualCents;
  }
  if (rentCents == null || rentCents <= 0) return { fieldErrors: { rent: "We couldn't estimate rent for this address. Enter the expected monthly rent." } };
  const est = estimateEscrow(state, listPriceCents!, ctxE);
  if (rateMilli == null) rateMilli = gridRate(ctxE.grid, { mode: "PURCHASE", fico: "740+", bucket: ">=1.20", product: "FIXED30", prepay: "5-4-3-2-1", pointsRatio: 0 });

  if (!realtorId) {
    const r = await db.realtor.create({ data: { brokerId: broker.id, name: d.newRealtorName!.trim(), brokerage: d.newRealtorBrokerage!.trim(), email: d.newRealtorEmail?.trim() || null, phone: d.newRealtorPhone?.trim() || null } });
    realtorId = r.id;
  }
  const snap = await db.snapshot.create({
    data: {
      brokerId: broker.id,
      ownerUserId: user?.id ?? broker.primaryUserId ?? "",
      realtorId,
      token: randomToken(),
      template: d.template,
      address: normalizeAddress(d.address).line,
      state,
      propertyType: d.propertyType,
      listPriceCents: listPriceCents!,
      rentCents,
      rentSource,
      taxesAnnualCents: taxesAnnualCents ?? est.taxesAnnualCents,
      insuranceAnnualCents: insAnnual ?? est.insuranceAnnualCents,
      hoaMonthlyCents: hoaCents,
      rateMilli,
      photoUrl: d.photoUrl || null,
    },
  });
  await emit(db, "snapshot.created", "Snapshot", snap.id, { realtorId }, user?.id);
  revalidatePath("/dashboard/snapshots");
  redirect(`/dashboard/snapshots/${snap.id}?created=1`);
}

export async function setSnapshotTemplate(id: string, template: "CLASSIC" | "MODERN") {
  const { db } = await ctx();
  const s = await db.snapshot.findFirst({ where: { id } });
  if (!s) return { ok: false };
  await db.snapshot.update({ where: { id }, data: { template } });
  revalidatePath(`/dashboard/snapshots/${id}`);
  return { ok: true };
}

export async function deleteSnapshot(id: string) {
  const { db } = await ctx();
  await db.snapshot.deleteMany({ where: { id } });
  revalidatePath("/dashboard/snapshots");
  redirect("/dashboard/snapshots");
}

/** Email a realtor their co-marketing stats (snapshots, scans, leads). Sent from the LO; no borrower PII. */
export async function emailRealtorStats(realtorId: string): Promise<{ ok: boolean; error?: string }> {
  const { db, broker, user } = await ctx();
  const r = await db.realtor.findFirst({ where: { id: realtorId } });
  if (!r) return { ok: false, error: "Realtor not found" };
  if (!r.email) return { ok: false, error: "Add the agent's email first" };
  const [stats] = await realtorStats(db, [r.id]);
  const brand = await staffBrand(broker, user);
  const ok = await sendBrandEmail({
    brand,
    to: r.email,
    replyTo: brand.lo.email,
    fromName: brand.lo.name,
    subject: `Your listing snapshots: ${stats!.scans30} scan${stats!.scans30 === 1 ? "" : "s"} in the last 30 days`,
    heading: `Hi ${r.name.split(" ")[0]}, here's how your listing snapshots are doing`,
    intro: "Investor buyers scan the QR code on your flyer to see live DSCR numbers and request financing. Here's the activity so far.",
    rows: [
      { label: "Listing snapshots", value: String(stats!.snapshots) },
      { label: "QR scans (30 days)", value: String(stats!.scans30) },
      { label: "QR scans (all time)", value: String(stats!.scans) },
      { label: "Financing requests", value: String(stats!.leads) },
    ],
    bullets: stats!.top.map((x) => `${x.address}: ${x.scans} scan${x.scans === 1 ? "" : "s"}, ${x.leads} request${x.leads === 1 ? "" : "s"}`),
    cta: { label: "Make a snapshot for your next listing", url: `mailto:${brand.lo.email}?subject=${encodeURIComponent("New listing snapshot")}` },
    footerNote: t_respa(broker.companyName, r.brokerage),
    tag: "snapshot.realtor_stats",
  });
  if (ok) await emit(db, "snapshot.stats_emailed", "Realtor", r.id, {}, user?.id);
  return ok ? { ok: true } : { ok: false, error: "Email could not be sent" };
}

function t_respa(company: string, brokerage: string) {
  return `${company} and ${brokerage} are independent companies; no fee or thing of value is paid for referrals.`;
}

