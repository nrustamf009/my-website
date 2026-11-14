import { NextResponse } from "next/server";
import { demoLoginEnabled, signIn } from "@/lib/auth/config";
import { DEMO_AGENCY_EMAIL, DEMO_COOKIE, demoBroker } from "@/lib/auth/demo";

export const dynamic = "force-dynamic";

/** Demo entry: /go?as=<broker slug|agency>&to=<path> (or ?email=). Signs in as the demo account, no form. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!demoLoginEnabled()) return NextResponse.redirect(new URL("/login", url));
  const as = url.searchParams.get("as");
  const rawTo = url.searchParams.get("to") ?? "";
  const agency = as === "agency";
  const to = rawTo.startsWith("/") && !rawTo.startsWith("//") ? rawTo : agency ? "/admin" : "/dashboard";
  // `email` picks any seeded demo account (e.g. a loan officer); `as` picks a demo broker or the agency.
  const explicit = url.searchParams.get("email");
  const email = explicit ?? (agency ? DEMO_AGENCY_EMAIL : demoBroker(as).email);
  if (!agency && !explicit) {
    const { cookies } = await import("next/headers");
    (await cookies()).set(DEMO_COOKIE, demoBroker(as).slug, { path: "/", sameSite: "lax", maxAge: 30 * 24 * 3600 });
  }
  await signIn("demo", { email, redirectTo: to });
  return NextResponse.redirect(new URL(to, url));
}
