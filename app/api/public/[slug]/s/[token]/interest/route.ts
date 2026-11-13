import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod/v4";
import { forBroker } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/request";
import { publicState } from "@/lib/scenarios";
import { loadPublicScenario, notifyInterest } from "@/lib/scenario-public";

const Body = z.object({ optionId: z.string().min(1).max(40), question: z.string().trim().max(1_000).optional() });

/** "I'm interested in Option B" (+ optional question). Switching options is allowed. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = await loadPublicScenario(slug, token);
  if (!r || r.pc.unavailable || publicState(r.s) !== "LIVE") return NextResponse.json({ error: "This scenario is no longer available." }, { status: 404 });
  const option = r.s.options.find((o) => o.id === body.data.optionId);
  if (!option) return NextResponse.json({ error: "Option not found" }, { status: 400 });
  if (!(await rateLimit(`int:${r.s.id}:${await clientKey()}`, 6, 3600))) return NextResponse.json({ error: "Too many requests. Please call or text instead." }, { status: 429 });
  const question = body.data.question || null;
  const { pc, s } = r;
  if (pc.unavailable) return NextResponse.json({ error: "Unavailable" }, { status: 404 });
  await forBroker(pc.broker.id).scenario.update({ where: { id: s.id }, data: { interestedOptionId: option.id, interestedAt: new Date(), interestQuestion: question } });
  after(() => notifyInterest(pc.broker, pc.brand, s, option, question));
  return NextResponse.json({ ok: true, label: option.label });
}
