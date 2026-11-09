import type { RentEstimate, RentEstimateInput, RentProvider } from "./types";

/** RentCast long-term rent AVM. Docs: https://developers.rentcast.io/reference/rent-estimate-long-term */
export class RentCastProvider implements RentProvider {
  readonly name = "rentcast" as const;
  constructor(private apiKey: string) {}

  async estimate(input: RentEstimateInput): Promise<RentEstimate | null> {
    const params = new URLSearchParams({ address: input.address });
    if (input.propertyType) params.set("propertyType", input.propertyType);
    if (input.bedrooms) params.set("bedrooms", String(input.bedrooms));
    if (input.bathrooms) params.set("bathrooms", String(input.bathrooms));
    if (input.squareFootage) params.set("squareFootage", String(input.squareFootage));
    const res = await fetch(`https://api.rentcast.io/v1/avm/rent/long-term?${params}`, {
      headers: { "X-Api-Key": this.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { rent?: number; rentRangeLow?: number; rentRangeHigh?: number };
    if (!data.rent) return null;
    return { rent: Math.round(data.rent), rentLow: data.rentRangeLow, rentHigh: data.rentRangeHigh, provider: "rentcast", cached: false };
  }
}
