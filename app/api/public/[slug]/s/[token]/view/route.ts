import { NextResponse, after } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { deviceFromUA } from "@/lib/request";
import { recordScenarioOpen, recordScenarioPing } from "@/lib/tracking";

const Body = z.object({ event: z.enum(["start", "ping"]), visitKey: z.string().min(10).max(64), seconds: z.number().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const raw = await req.text();
  const parsed = Body.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const scenario = await prisma.scenario.findFirst({ where: { token, broker: { slug, active: true }, status: { not: "ARCHIVED" } }, include: { broker: true } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Don't count the broker's (or their agency admin's) own previews.
  const session = await auth();
  if (session?.user && (session.user.brokerId === scenario.brokerId || session.user.agencyId === scenario.broker.agencyId)) return NextResponse.json({ ok: true, tracked: false });

  if (parsed.data.event === "start") {
    const device = deviceFromUA(req.headers.get("user-agent"));
    after(() => recordScenarioOpen(scenario, scenario.broker, parsed.data.visitKey, device));
  } else {
    await recordScenarioPing(scenario.id, parsed.data.visitKey, parsed.data.seconds ?? 0);
  }
  return NextResponse.json({ ok: true, tracked: true });
}
