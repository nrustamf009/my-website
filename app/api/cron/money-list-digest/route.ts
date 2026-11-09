import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMoneyListDigest } from "@/lib/moneylist/digest";
import { safeEqual } from "@/lib/tokens";
import { log } from "@/lib/log";

export const maxDuration = 300;

/** Monthly digest (Vercel Cron, see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brokers = await prisma.broker.findMany({ where: { active: true, digestEnabled: true }, select: { id: true } });
  let sent = 0;
  for (const b of brokers) {
    try {
      const r = await sendMoneyListDigest(b.id);
      if (r.sent) sent++;
    } catch (err) {
      log.error("digest.failed", err, { brokerId: b.id });
    }
  }
  return NextResponse.json({ brokers: brokers.length, sent });
}
