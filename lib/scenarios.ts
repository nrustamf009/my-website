import type { Scenario, ScenarioOption } from "@prisma/client";
import { compareOptions, computeScenarioOption, type Mode, type Prepay, type Product, type ProgramGrid, type ScenarioOptionInput, type ScenarioOptionResult, type ScenarioPropertyInput } from "@/lib/dscr";

export const SCENARIO_TTL_DAYS = 30;
export const OPTION_LABELS = ["A", "B", "C"] as const;

export const propertyOf = (s: Scenario): ScenarioPropertyInput => ({
  mode: s.mode as Mode,
  valueCents: s.valueCents,
  rentCents: s.rentCents,
  taxesAnnualCents: s.taxesAnnualCents,
  insuranceAnnualCents: s.insuranceAnnualCents,
  hoaMonthlyCents: s.hoaMonthlyCents,
  currentBalanceCents: s.currentBalanceCents,
});

export const optionOf = (o: ScenarioOption): ScenarioOptionInput => ({
  product: o.product as Product,
  loanAmountCents: o.loanAmountCents,
  rateMilli: o.rateMilli,
  pointsRatio: o.pointsRatio,
  feesCents: o.feesCents,
  prepay: o.prepay as Prepay,
});

export interface ComputedOption {
  option: ScenarioOption;
  input: ScenarioOptionInput;
  result: ScenarioOptionResult;
  /** Compared with option A (first option); null for A itself. */
  vsFirst: ReturnType<typeof compareOptions> | null;
}

export function computeOptions(s: Scenario & { options: ScenarioOption[] }, grid: ProgramGrid): ComputedOption[] {
  const prop = propertyOf(s);
  const sorted = [...s.options].sort((a, b) => a.sortOrder - b.sortOrder);
  const rows = sorted.map((o) => ({ option: o, input: optionOf(o), result: computeScenarioOption(prop, optionOf(o), grid) }));
  return rows.map((r, i) => ({ ...r, vsFirst: i === 0 ? null : compareOptions(rows[0]!.result, r.result, rows[0]!.input, r.input) }));
}

export type PublicState = "LIVE" | "EXPIRED" | "REVOKED" | "DRAFT";
export function publicState(s: Pick<Scenario, "status" | "expiresAt" | "revokedAt">, now = new Date()): PublicState {
  if (s.revokedAt) return "REVOKED";
  if (s.expiresAt <= now) return "EXPIRED";
  return s.status === "DRAFT" ? "DRAFT" : "LIVE";
}

export const expiryFrom = (d = new Date()) => new Date(d.getTime() + SCENARIO_TTL_DAYS * 86_400_000);
