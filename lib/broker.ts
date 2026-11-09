import type { Broker } from "@prisma/client";
import { DEFAULT_FICO_LTV_CAPS, SYSTEM_DEFAULTS, type BrokerDefaults, type FicoLtvCap } from "@/lib/dscr";
import { prisma } from "@/lib/db";

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Map a Broker row to the math core's defaults. */
export function brokerDefaults(b: Pick<Broker, "minDscr" | "maxLtv" | "defaultRate" | "termYears" | "taxRatePct" | "insuranceRatePct" | "borderlineBand" | "ficoLtvCaps">): BrokerDefaults {
  const caps = parseJson<FicoLtvCap[]>(b.ficoLtvCaps, []);
  return {
    ...SYSTEM_DEFAULTS,
    minDscr: b.minDscr,
    maxLtv: b.maxLtv,
    defaultRate: b.defaultRate,
    termYears: b.termYears,
    taxRatePct: b.taxRatePct,
    insuranceRatePct: b.insuranceRatePct,
    borderlineBand: b.borderlineBand,
    ficoLtvCaps: caps.length ? caps : DEFAULT_FICO_LTV_CAPS,
  };
}

/** Fields safe to expose on public pages. */
export type PublicBroker = Pick<
  Broker,
  "id" | "slug" | "name" | "title" | "companyName" | "nmlsId" | "companyNmlsId" | "logoUrl" | "accentColor" | "email" | "phone" | "website" | "licensedStates" | "disclaimerText"
>;

export const PUBLIC_BROKER_SELECT = {
  id: true,
  slug: true,
  name: true,
  title: true,
  companyName: true,
  nmlsId: true,
  companyNmlsId: true,
  logoUrl: true,
  accentColor: true,
  email: true,
  phone: true,
  website: true,
  licensedStates: true,
  disclaimerText: true,
} as const;

export async function getActiveBrokerBySlug(slug: string) {
  return prisma.broker.findFirst({ where: { slug, active: true } });
}

export const DEFAULT_DISCLAIMER =
  "This is an estimate for informational purposes only and is not an offer to lend, a loan approval, or a commitment to lend. Rates, terms, and eligibility depend on full underwriting, property appraisal, and lender guidelines and are subject to change without notice. Equal Housing Opportunity.";
