import { NextResponse } from "next/server";
import { getPublicContext } from "@/lib/broker";
import { lookupProperty } from "@/lib/providers/property";
import { normalizeAddress } from "@/lib/providers/address";
import { clientKey, rateLimit } from "@/lib/request";

/** Rent range + taxes for an address (cached 30 days). Public but rate-limited and slug-scoped. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  if (address.length < 8) return NextResponse.json({ error: "Enter a full address" }, { status: 400 });
  const pc = await getPublicContext(slug);
  if (!pc || pc.unavailable) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await rateLimit(`prop:${await clientKey()}`, 30, 3600))) return NextResponse.json({ error: "Too many lookups. Enter rent manually." }, { status: 429 });
  const price = Number(url.searchParams.get("priceCents")) || undefined;
  const r = await lookupProperty(address, { priceCents: price });
  return NextResponse.json({ property: r, state: normalizeAddress(address).state });
}
