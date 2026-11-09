import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBrokerBySlug } from "@/lib/broker";
import { createPublicLead } from "@/lib/leads";
import { fieldErrors, PublicLeadSchema } from "@/lib/validation";
import { clientKey, rateLimit } from "@/lib/request";
import { log } from "@/lib/log";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const broker = await getActiveBrokerBySlug(slug);
  if (!broker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PublicLeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  const input = parsed.data;

  // Spam protection: honeypot + minimum time on form + rate limits.
  if (input.contact.company || (input.contact.elapsedMs !== undefined && input.contact.elapsedMs < 1500)) {
    return NextResponse.json({ ok: true, leadId: null });
  }
  const ipKey = await clientKey();
  const allowed = (await rateLimit(`lead:ip:${ipKey}`, 8, 3600)) && (await rateLimit(`lead:email:${broker.id}:${input.contact.email.toLowerCase()}`, 3, 3600));
  if (!allowed) return NextResponse.json({ error: "Too many requests. Please try again later or call us directly." }, { status: 429 });

  let snapshot = null;
  if (input.source === "LISTING") {
    snapshot = await prisma.snapshot.findFirst({ where: { token: input.snapshotToken ?? "", brokerId: broker.id }, include: { realtor: true } });
    if (!snapshot) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  try {
    const { lead, notify } = await createPublicLead(broker, input, snapshot);
    after(notify);
    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    log.error("lead.create_failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
