import { NextResponse, after } from "next/server";
import { forBroker } from "@/lib/db";
import { getPublicContext } from "@/lib/broker";
import { createPublicLead } from "@/lib/leads";
import { fieldErrors, PublicLeadSchema } from "@/lib/check/form";
import { getBotCheck } from "@/lib/providers/bot";
import { clientIp, clientKey, rateLimit, userAgent } from "@/lib/request";
import { log } from "@/lib/log";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PublicLeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  const input = parsed.data;
  const pc = await getPublicContext(slug, { loSlug: input.lo, feature: input.source === "SNAPSHOT" ? "snapshot" : "check" });
  if (!pc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pc.unavailable) return NextResponse.json({ error: "This page is unavailable." }, { status: 410 });

  // Spam: honeypot + time-on-form + Turnstile + rate limits (per IP hash and per email).
  if (input.contact.company || (input.contact.elapsedMs !== undefined && input.contact.elapsedMs < 1500)) return NextResponse.json({ ok: true });
  const ip = await clientIp();
  if (!(await getBotCheck().verify(input.turnstileToken, ip))) return NextResponse.json({ error: "Please complete the verification and try again." }, { status: 400 });
  const key = await clientKey();
  const allowed = (await rateLimit(`lead:ip:${key}`, 8, 3600)) && (await rateLimit(`lead:email:${pc.broker.id}:${input.contact.email.toLowerCase()}`, 4, 3600));
  if (!allowed) return NextResponse.json({ error: "Too many requests. Please call us directly." }, { status: 429 });

  let snapshot = null;
  if (input.source === "SNAPSHOT") {
    snapshot = await forBroker(pc.broker.id).snapshot.findFirst({ where: { token: input.snapshotToken ?? "" }, include: { realtor: true } });
    if (!snapshot) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  try {
    const { lead, notify } = await createPublicLead({ broker: pc.broker, brand: pc.brand, ctx: pc.ctx, input, ip, userAgent: await userAgent(), snapshot });
    after(notify);
    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    log.error("lead.create_failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
