import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { forBroker } from "@/lib/db";
import { emit } from "@/lib/events";
import { rateLimit } from "@/lib/request";
import { publicState } from "@/lib/scenarios";
import { isStaff, loadPublicScenario } from "@/lib/scenario-public";

const Body = z.object({ optionId: z.string().min(1).max(40), visitKey: z.string().min(8).max(64) });

/** The investor opened an option's details (once per option per visit). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await loadPublicScenario(slug, token);
  if (!r || r.pc.unavailable || publicState(r.s) !== "LIVE") return NextResponse.json({ ok: false }, { status: 404 });
  if (!r.s.options.some((o) => o.id === body.data.optionId)) return NextResponse.json({ ok: false }, { status: 400 });
  if (await isStaff(r.pc.broker.id, r.pc.broker.agencyId)) return NextResponse.json({ ok: true, tracked: false });
  if (!(await rateLimit(`exp:${body.data.visitKey}:${body.data.optionId}`, 1, 86_400))) return NextResponse.json({ ok: true, tracked: false });
  await emit(forBroker(r.pc.broker.id), "scenario.option_expanded", "Scenario", r.s.id, { optionId: body.data.optionId });
  return NextResponse.json({ ok: true, tracked: true });
}
