"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireBroker } from "@/lib/auth/session";

const STATUSES = ["NEW", "CONTACTED", "ARCHIVED"] as const;

export async function setLeadStatus(id: string, status: (typeof STATUSES)[number]) {
  const { broker } = await requireBroker();
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  await prisma.lead.updateMany({ where: { id, brokerId: broker.id }, data: { status } });
  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${id}`);
}
