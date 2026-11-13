import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod/v4";
import { forBroker } from "@/lib/db";
import { emit } from "@/lib/events";
import { currentDevice } from "@/lib/request";
import { publicState } from "@/lib/scenarios";
import { isStaff, loadPublicScenario, notifyOpened } from "@/lib/scenario-public";

const Body = z.object({ visitKey: z.string().min(8).max(64), phase: z.enum(["start", "ping"]), activeSeconds: z.number().int().min(0).max(86_400).optional() });
const DAY = 86_400_000;

/** Visit tracking: "start" once per page load, then "ping" with active (visible) seconds. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await loadPublicScenario(slug, token);
  if (!r || r.pc.unavailable || publicState(r.s) !== "LIVE") return NextResponse.json({ ok: false }, { status: 404 });
  const { pc, s } = r;
  if (await isStaff(pc.broker.id, pc.broker.agencyId)) return NextResponse.json({ ok: true, tracked: false });
  const db = forBroker(pc.broker.id);
  const { visitKey, phase, activeSeconds = 0 } = body.data;
  const now = new Date();

  if (phase === "ping") {
    await db.scenarioView.updateMany({ where: { scenarioId: s.id, visitKey }, data: { activeSeconds, lastSeenAt: now } });
    return NextResponse.json({ ok: true });
  }

  const existing = await db.scenarioView.findFirst({ where: { visitKey } });
  if (existing) return NextResponse.json({ ok: true });
  const previous = await db.scenarioView.findFirst({ where: { scenarioId: s.id }, orderBy: { lastSeenAt: "desc" } });
  const device = await currentDevice();
  await db.scenario.update({ where: { id: s.id }, data: { views: { create: { visitKey, device } }, ...(s.firstOpenedAt ? {} : { firstOpenedAt: now }) } });

  let kind: "first" | "reopen" | null = null;
  if (!s.firstOpenedAt) kind = "first";
  else if (previous && now.getTime() - previous.lastSeenAt.getTime() >= DAY) kind = "reopen";
  if (kind) {
    await emit(db, kind === "first" ? "scenario.opened" : "scenario.reopened", "Scenario", s.id, { device });
    await db.scenario.update({ where: { id: s.id }, data: { lastNotifiedAt: now } });
    after(() => notifyOpened(pc.broker, pc.brand, s, kind!, device));
  }
  return NextResponse.json({ ok: true, notified: kind });
}
