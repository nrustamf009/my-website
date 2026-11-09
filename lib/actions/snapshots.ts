"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { requireBroker } from "@/lib/auth/session";
import { escrowFromPrice } from "@/lib/dscr";
import { randomToken } from "@/lib/tokens";
import { fieldErrors } from "@/lib/validation";

export type SnapshotFormState = { fieldErrors?: Record<string, string>; error?: string };

const logo = z
  .string()
  .max(360_000, "Logo must be under 256 KB")
  .refine((v) => v === "" || /^data:image\/(png|jpeg);base64,/.test(v) || /^https:\/\//.test(v), "Logo must be a PNG or JPG")
  .optional();

const SnapshotInput = z.object({
  address: z.string().trim().min(6, "Enter the full property address").max(200),
  price: z.coerce.number().min(10_000, "Enter the list price").max(50_000_000),
  monthlyRent: z.coerce.number().min(100, "Enter the expected rent").max(1_000_000),
  rentSource: z.enum(["RENTCAST", "MOCK", "MANUAL"]),
  ratePct: z.coerce.number().min(0.5, "Enter a rate").max(20),
  taxesMonthly: z.coerce.number().min(0).max(100_000).optional(),
  insuranceMonthly: z.coerce.number().min(0).max(100_000).optional(),
  hoaMonthly: z.coerce.number().min(0).max(100_000).default(0),
  realtorId: z.string().optional(),
  realtorName: z.string().trim().max(100).optional(),
  realtorBrokerage: z.string().trim().max(100).optional(),
  realtorEmail: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  realtorPhone: z.string().trim().max(30).optional(),
  realtorLogo: logo,
});

export async function createSnapshot(_prev: SnapshotFormState, formData: FormData): Promise<SnapshotFormState> {
  const { broker } = await requireBroker();
  const raw = Object.fromEntries(Array.from(formData.entries()).filter(([, v]) => v !== ""));
  const parsed = SnapshotInput.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  let realtorId = d.realtorId && d.realtorId !== "new" ? d.realtorId : null;
  if (realtorId) {
    const r = await prisma.realtor.findFirst({ where: { id: realtorId, brokerId: broker.id } });
    if (!r) return { error: "Realtor not found" };
  } else {
    if (!d.realtorName || d.realtorName.length < 2) return { fieldErrors: { realtorName: "Enter the realtor's name" } };
    if (!d.realtorBrokerage || d.realtorBrokerage.length < 2) return { fieldErrors: { realtorBrokerage: "Enter the brokerage" } };
    const r = await prisma.realtor.create({
      data: { brokerId: broker.id, name: d.realtorName, brokerage: d.realtorBrokerage, email: d.realtorEmail || null, phone: d.realtorPhone || null, logoUrl: d.realtorLogo || null },
    });
    realtorId = r.id;
  }

  const escrow = escrowFromPrice(d.price, broker.taxRatePct, broker.insuranceRatePct);
  const snap = await prisma.snapshot.create({
    data: {
      brokerId: broker.id,
      realtorId,
      token: randomToken(12),
      address: d.address,
      price: Math.round(d.price),
      monthlyRent: Math.round(d.monthlyRent),
      rentSource: d.rentSource,
      ratePct: d.ratePct,
      taxesMonthly: d.taxesMonthly ?? Math.round(escrow.taxesMonthly),
      insuranceMonthly: d.insuranceMonthly ?? Math.round(escrow.insuranceMonthly),
      hoaMonthly: d.hoaMonthly,
    },
  });
  revalidatePath("/dashboard/snapshots");
  redirect(`/dashboard/snapshots/${snap.id}?created=1`);
}

export async function deleteSnapshot(id: string) {
  const { broker } = await requireBroker();
  await prisma.snapshot.deleteMany({ where: { id, brokerId: broker.id } });
  revalidatePath("/dashboard/snapshots");
  redirect("/dashboard/snapshots");
}
