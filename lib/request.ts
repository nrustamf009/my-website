import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export function deviceFromUA(ua: string | null | undefined): "mobile" | "desktop" {
  return ua && /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
}

export async function currentDevice() {
  const h = await headers();
  return deviceFromUA(h.get("user-agent"));
}

/** Hash of client IP (never stored raw). */
export async function clientKey() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** Simple DB-backed sliding-window rate limit. Returns true when allowed. */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= max) return false;
  await prisma.rateLimitHit.create({ data: { key } });
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400_000) } } });
  }
  return true;
}

/** Raw client IP. Stored ONLY on consent records as evidence (TCPA); never logged. */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function userAgent() {
  return (await headers()).get("user-agent") ?? "unknown";
}
