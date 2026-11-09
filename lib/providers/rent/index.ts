import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { MockRentProvider } from "./mock";
import { RentCastProvider } from "./rentcast";
import type { RentEstimate, RentEstimateInput, RentProvider } from "./types";

export type { RentEstimate, RentEstimateInput, RentProvider } from "./types";

const CACHE_DAYS = 30;

export function getRentProvider(): RentProvider {
  return env.rentcastKey ? new RentCastProvider(env.rentcastKey) : new MockRentProvider();
}

export function normalizeAddress(a: string): string {
  return a.toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
}

/** Estimate with a 30-day cache (RentCast free tier = 50 calls/month). Never throws. */
export async function estimateRent(input: RentEstimateInput): Promise<RentEstimate | null> {
  const provider = getRentProvider();
  if (provider.name === "mock") return provider.estimate(input);
  const addressKey = normalizeAddress(input.address);
  try {
    const cached = await prisma.rentEstimateCache.findUnique({ where: { addressKey } });
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_DAYS * 86400_000) {
      return { rent: cached.rent, rentLow: cached.rentLow ?? undefined, rentHigh: cached.rentHigh ?? undefined, provider: "rentcast", cached: true };
    }
    const fresh = await provider.estimate(input);
    if (fresh) {
      await prisma.rentEstimateCache.upsert({
        where: { addressKey },
        create: { addressKey, rent: fresh.rent, rentLow: fresh.rentLow, rentHigh: fresh.rentHigh, provider: fresh.provider },
        update: { rent: fresh.rent, rentLow: fresh.rentLow, rentHigh: fresh.rentHigh, provider: fresh.provider, fetchedAt: new Date() },
      });
    }
    return fresh;
  } catch (err) {
    log.error("rent.estimate_failed", err);
    return null;
  }
}
