import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { forBroker } from "@/lib/db";
import { getPublicContext } from "@/lib/broker";
import { getStaffSession } from "@/lib/auth/session";
import { emit } from "@/lib/events";
import { clientKey, currentDevice, rateLimit } from "@/lib/request";

const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("check.calculated"), verdict: z.string().max(30).optional(), utmSource: z.string().max(100).optional() }),
  z.object({ type: z.literal("snapshot.scanned"), token: z.string().min(4).max(64), src: z.string().max(20).optional() }),
]);

/**
 * Anonymous usage beacons: Instant Check runs (one per session) and listing-snapshot views
 * (one per visitor per listing per 6 hours). Staff of the broker or agency are never counted.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const body = parsed.data;
  const pc = await getPublicContext(slug, { feature: body.type === "snapshot.scanned" ? "snapshot" : "check" });
  if (!pc || pc.unavailable) return NextResponse.json({ ok: false }, { status: 404 });
  const session = await getStaffSession();
  if (session?.user && (session.user.brokerId === pc.broker.id || session.user.agencyId === pc.broker.agencyId)) return NextResponse.json({ ok: true, tracked: false });
  const db = forBroker(pc.broker.id);
  const who = await clientKey();
  if (body.type === "snapshot.scanned") {
    const snap = await db.snapshot.findFirst({ where: { token: body.token }, select: { id: true, realtorId: true } });
    if (!snap) return NextResponse.json({ ok: false }, { status: 404 });
    if (!(await rateLimit(`scan:${snap.id}:${who}`, 1, 6 * 3600))) return NextResponse.json({ ok: true, tracked: false });
    await emit(db, "snapshot.scanned", "Snapshot", snap.id, { realtorId: snap.realtorId, src: body.src === "qr" ? "qr" : "link", device: await currentDevice() });
    return NextResponse.json({ ok: true, tracked: true });
  }
  if (!(await rateLimit(`evt:${pc.broker.id}:${who}`, 5, 3600))) return NextResponse.json({ ok: true, tracked: false });
  await emit(db, "check.calculated", "Broker", pc.broker.id, { verdict: body.verdict ?? null, utmSource: body.utmSource ?? null });
  return NextResponse.json({ ok: true, tracked: true });
}
