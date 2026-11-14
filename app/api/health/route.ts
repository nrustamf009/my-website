import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { demoLoginEnabled } from "@/lib/auth/demo";

export const dynamic = "force-dynamic";

/** Deploy check: is the database reachable and seeded? No secrets in the response. */
export async function GET() {
  const out: Record<string, unknown> = { demo: demoLoginEnabled(), databaseUrlSet: !!process.env.DATABASE_URL };
  try {
    out.brokers = await prisma.broker.count();
    out.db = "ok";
  } catch (e) {
    out.db = "error";
    out.error = String((e as Error)?.message ?? e).split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300);
  }
  return NextResponse.json(out, { status: out.db === "ok" ? 200 : 500 });
}
