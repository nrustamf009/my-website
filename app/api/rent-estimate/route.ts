import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getActiveBrokerBySlug } from "@/lib/broker";
import { estimateRent } from "@/lib/providers/rent";
import { clientKey, rateLimit } from "@/lib/request";

/** Rent estimate for public widgets (slug-scoped, rate-limited) and the dashboard (signed in). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  const slug = url.searchParams.get("slug");
  const price = Number(url.searchParams.get("price")) || undefined;
  if (address.length < 6) return NextResponse.json({ error: "Enter a full address" }, { status: 400 });

  const session = await auth();
  if (!session?.user) {
    if (!slug || !(await getActiveBrokerBySlug(slug))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await rateLimit(`rent:${await clientKey()}`, 20, 3600))) return NextResponse.json({ error: "Too many lookups. Enter rent manually." }, { status: 429 });
  }
  const estimate = await estimateRent({ address, priceHint: price });
  if (!estimate) return NextResponse.json({ estimate: null });
  return NextResponse.json({ estimate });
}
