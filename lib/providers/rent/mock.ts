import type { RentEstimate, RentEstimateInput, RentProvider } from "./types";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Deterministic fake estimate (same address => same rent). Clearly labeled as mock in the UI. */
export class MockRentProvider implements RentProvider {
  readonly name = "mock" as const;
  async estimate(input: RentEstimateInput): Promise<RentEstimate | null> {
    if (!input.address.trim()) return null;
    const h = hash(input.address.trim().toLowerCase());
    // ~0.68%–0.86% of price per month when a price is known; otherwise $1,650–$3,400.
    const rent = input.priceHint ? input.priceHint * (0.0068 + h * 0.0018) : 1650 + h * 1750;
    const r = Math.round(rent / 25) * 25;
    return { rent: r, rentLow: Math.round((r * 0.9) / 25) * 25, rentHigh: Math.round((r * 1.1) / 25) * 25, provider: "mock", cached: false };
  }
}
