import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { runMonthlyDigests } from "@/lib/moneylist/digest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runMonthlyDigests());
}
