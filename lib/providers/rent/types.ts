export interface RentEstimateInput {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  propertyType?: "Single Family" | "Condo" | "Townhouse" | "Multi-Family";
  /** Purchase price hint; only the mock uses it. */
  priceHint?: number;
}

export interface RentEstimate {
  rent: number;
  rentLow?: number;
  rentHigh?: number;
  provider: "rentcast" | "mock";
  cached: boolean;
}

export interface RentProvider {
  readonly name: "rentcast" | "mock";
  /** Returns null when no estimate is available; the UI then asks for manual rent. */
  estimate(input: RentEstimateInput): Promise<RentEstimate | null>;
}
