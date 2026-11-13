import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { forBroker } from "@/lib/db";
import { getPublicContext } from "@/lib/broker";
import { auth } from "@/lib/auth/config";
import { emit } from "@/lib/events";
import { clientKey, rateLimit } from "@/lib/request";

const Body = z.object({ type: z.literal("check.calculated"), verdict: z.string().max(30).optional(), utmSource: z.string().max(100).optional() });

/** Anonymous widget usage (one per session) so brokers see how many investors ran numbers. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const pc = await getPublicContext(slug, { feature: "check" });
  if (!pc || pc.unavailable) return NextResponse.json({ ok: false }, { status: 404 });
  const session = await auth();
  if (session?.user && (session.user.brokerId === pc.broker.id || session.user.agencyId === pc.broker.agencyId)) return NextResponse.json({ ok: true, tracked: false });
  if (!(await rateLimit(`evt:${pc.broker.id}:${await clientKey()}`, 5, 3600))) return NextResponse.json({ ok: true, tracked: false });
  await emit(forBroker(pc.broker.id), "check.calculated", "Broker", pc.broker.id, { verdict: parsed.data.verdict ?? null, utmSource: parsed.data.utmSource ?? null });
  return NextResponse.json({ ok: true, tracked: true });
}
