import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { runAgencyRollups } from "@/lib/roi";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runAgencyRollups());
}
