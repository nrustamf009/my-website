import { isUsState, type UsState } from "@/lib/dscr";

export interface NormalizedAddress {
  line: string;
  /** Lowercase, punctuation-free key used for caching and dedupe. */
  key: string;
  state: UsState | null;
  zip: string | null;
}

const SUFFIXES: Record<string, string> = { street: "st", avenue: "ave", road: "rd", drive: "dr", lane: "ln", court: "ct", boulevard: "blvd", place: "pl", trail: "trl", terrace: "ter", circle: "cir", parkway: "pkwy" };

/** Basic normalization without any paid service: trims, standardizes suffixes, extracts state and ZIP. */
export function normalizeAddress(raw: string): NormalizedAddress {
  const line = raw.trim().replace(/\s+/g, " ");
  const m = line.match(/,?\s*([A-Za-z]{2})\.?\s+(\d{5})(?:-\d{4})?\s*$/);
  const state = m && isUsState(m[1]!.toUpperCase()) ? (m[1]!.toUpperCase() as UsState) : null;
  const key = line
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIXES[w] ?? w)
    .join(" ");
  return { line, key, state, zip: m?.[2] ?? null };
}

/** Optional autocomplete behind an interface. Default: none (plain input). */
export interface AddressProvider {
  readonly mode: "none";
  suggest(q: string): Promise<NormalizedAddress[]>;
}

export const getAddressProvider = (): AddressProvider => ({ mode: "none", suggest: async () => [] });
