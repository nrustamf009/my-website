import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { normalizeAddress } from "@/lib/providers/address";

export interface PropertyLookup {
  rentCents: number | null;
  rentLowCents: number | null;
  rentHighCents: number | null;
  taxesAnnualCents: number | null;
  provider: "rentcast" | "mock";
  cached: boolean;
}

export interface PropertyProvider {
  readonly name: "rentcast" | "mock";
  lookup(address: string, hint?: { priceCents?: number; bedrooms?: number }): Promise<Omit<PropertyLookup, "cached"> | null>;
}

/** RentCast: long-term rent AVM + public-record property taxes. Docs: developers.rentcast.io */
class RentCastProvider implements PropertyProvider {
  readonly name = "rentcast" as const;
  constructor(private key: string) {}
  async lookup(address: string) {
    const h = { "X-Api-Key": this.key, Accept: "application/json" };
    const q = encodeURIComponent(address);
    const [rentRes, propRes] = await Promise.all([
      fetch(`https://api.rentcast.io/v1/avm/rent/long-term?address=${q}`, { headers: h, signal: AbortSignal.timeout(8000) }),
      fetch(`https://api.rentcast.io/v1/properties?address=${q}`, { headers: h, signal: AbortSignal.timeout(8000) }).catch(() => null),
    ]);
    if (!rentRes.ok) return null;
    const r = (await rentRes.json()) as { rent?: number; rentRangeLow?: number; rentRangeHigh?: number };
    let taxes: number | null = null;
    if (propRes?.ok) {
      const p = (await propRes.json()) as Array<{ propertyTaxes?: Record<string, { total?: number }> }>;
      const t = p?.[0]?.propertyTaxes;
      if (t) {
        const latest = Object.keys(t).sort().pop();
        if (latest && t[latest]?.total) taxes = Math.round(t[latest]!.total! * 100);
      }
    }
    if (!r.rent) return null;
    return {
      rentCents: Math.round(r.rent * 100),
      rentLowCents: r.rentRangeLow ? Math.round(r.rentRangeLow * 100) : null,
      rentHighCents: r.rentRangeHigh ? Math.round(r.rentRangeHigh * 100) : null,
      taxesAnnualCents: taxes,
      provider: "rentcast" as const,
    };
  }
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Deterministic mock: same address → same rent range. No tax record (state defaults apply). */
class MockPropertyProvider implements PropertyProvider {
  readonly name = "mock" as const;
  async lookup(address: string, hint?: { priceCents?: number }) {
    const k = normalizeAddress(address).key;
    if (k.length < 6) return null;
    const h = hash(k);
    const base = hint?.priceCents ? (hint.priceCents * (68 + h * 18)) / 10_000 : (1_650 + h * 1_750) * 100;
    const rent = Math.round(base / 2_500) * 2_500;
    return { rentCents: rent, rentLowCents: Math.round((rent * 0.9) / 2_500) * 2_500, rentHighCents: Math.round((rent * 1.1) / 2_500) * 2_500, taxesAnnualCents: null, provider: "mock" as const };
  }
}

export function getPropertyProvider(): PropertyProvider {
  return env.rentcastKey ? new RentCastProvider(env.rentcastKey) : new MockPropertyProvider();
}

const CACHE_DAYS = 30;

/** Lookup with a 30-day cache per normalized address. Never throws; null → user enters numbers. */
export async function lookupProperty(address: string, hint?: { priceCents?: number }): Promise<PropertyLookup | null> {
  const provider = getPropertyProvider();
  if (provider.name === "mock") {
    const r = await provider.lookup(address, hint);
    return r ? { ...r, cached: false } : null;
  }
  const key = normalizeAddress(address).key;
  try {
    const c = await prisma.propertyCache.findUnique({ where: { addressKey: key } });
    if (c && Date.now() - c.fetchedAt.getTime() < CACHE_DAYS * 86_400_000) {
      return { rentCents: c.rentCents, rentLowCents: c.rentLowCents, rentHighCents: c.rentHighCents, taxesAnnualCents: c.taxesAnnualCents, provider: "rentcast", cached: true };
    }
    const r = await provider.lookup(address, hint);
    if (r) {
      const data = { rentCents: r.rentCents, rentLowCents: r.rentLowCents, rentHighCents: r.rentHighCents, taxesAnnualCents: r.taxesAnnualCents, provider: r.provider, fetchedAt: new Date() };
      await prisma.propertyCache.upsert({ where: { addressKey: key }, create: { addressKey: key, ...data }, update: data });
    }
    return r ? { ...r, cached: false } : null;
  } catch (err) {
    log.error("property.lookup_failed", err);
    return null;
  }
}
