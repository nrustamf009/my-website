import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { pickPublic } from "@/lib/leads";
import { renderListingSnapshotPdf } from "@/lib/pdf/ListingSnapshotPdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { broker } = await requireBroker();
  const { id } = await params;
  const snapshot = await prisma.snapshot.findFirst({ where: { id, brokerId: broker.id }, include: { realtor: true } });
  if (!snapshot) return new Response("Not found", { status: 404 });
  const pdf = await renderListingSnapshotPdf({ broker: pickPublic(broker), realtor: snapshot.realtor, snapshot, url: `${env.appUrl}/b/${broker.slug}/l/${snapshot.token}?src=qr` });
  const name = `Investor-Snapshot-${snapshot.address.split(",")[0]!.replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
}
