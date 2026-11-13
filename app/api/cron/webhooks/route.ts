import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { retryDueWebhooks } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Retries queued webhook deliveries whose backoff has elapsed (2 min, 10 min, 1 h, 6 h). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await retryDueWebhooks());
}
