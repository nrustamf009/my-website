import { env } from "@/lib/env";
import { safeEqual } from "@/lib/tokens";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a secret, crons only run in development. */
export function cronAuthorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return got.length > 0 && safeEqual(got, secret);
}
