import { NextResponse } from "next/server";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, staffBrand } from "@/lib/broker";
import { prisma } from "@/lib/db";
import { snapshotPdf } from "@/lib/snapshots-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { db, broker, user } = await requireBroker();
  const { id } = await params;
  const s = await db.snapshot.findFirst({ where: { id }, include: { realtor: true } });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owner = s.ownerUserId ? await prisma.user.findFirst({ where: { id: s.ownerUserId, brokerId: broker.id } }) : null;
  const tpl = new URL(req.url).searchParams.get("template");
  const pdf = await snapshotPdf(broker, await staffBrand(broker, owner ?? user), engineContext(broker), s, tpl === "MODERN" || tpl === "CLASSIC" ? tpl : undefined);
  const name = s.address.split(",")[0]!.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="snapshot-${name}.pdf"`, "Cache-Control": "private, no-store" } });
}
