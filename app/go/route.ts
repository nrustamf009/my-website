import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEMO_COOKIE, IMPERSONATE_COOKIE_NAME, demoBroker, demoLoginEnabled } from "@/lib/auth/demo";

export const dynamic = "force-dynamic";

/**
 * Demo switch: /go?as=<broker slug|agency>&to=<path> (or ?email=<seeded account>). No sign-in:
 * it only remembers which demo account the visitor acts as, then redirects.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!demoLoginEnabled()) return NextResponse.redirect(new URL("/login", url));
  const as = url.searchParams.get("as");
  const email = url.searchParams.get("email");
  const agency = as === "agency";
  const rawTo = url.searchParams.get("to") ?? "";
  const to = rawTo.startsWith("/") && !rawTo.startsWith("//") ? rawTo : agency ? "/admin" : "/dashboard";
  const jar = await cookies();
  jar.set(DEMO_COOKIE, email && email.includes("@") ? email.toLowerCase() : agency ? "agency" : demoBroker(as).slug, { path: "/", sameSite: "lax", maxAge: 30 * 24 * 3600 });
  jar.delete(IMPERSONATE_COOKIE_NAME);
  return NextResponse.redirect(new URL(to, url));
}
