import type { Broker, DisclaimerVersion, User } from "@prisma/client";
import { forBroker, prisma } from "@/lib/db";
import { DEFAULT_MONEY_LIST_RULES, STATE_DEFAULTS, normalizeGrid, type EngineContext, type MoneyListRules, type StateDefault, type UsState } from "@/lib/dscr";
import { DEFAULT_DISCLAIMER } from "@/lib/compliance/disclaimers";
import { getTheme, type ThemeId } from "@design";

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type FeatureKey = "check" | "moneyList" | "snapshot" | "scenario" | "notes";
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  check: "DSCR Instant Check",
  moneyList: "Money List",
  snapshot: "Listing Snapshot",
  scenario: "Scenario Sheet",
  notes: "Notes-to-Scenario",
};
export const ALL_FEATURES: Record<FeatureKey, boolean> = { check: true, moneyList: true, snapshot: true, scenario: true, notes: true };

export function features(b: Pick<Broker, "features">): Record<FeatureKey, boolean> {
  return { ...ALL_FEATURES, ...parseJson<Partial<Record<FeatureKey, boolean>>>(b.features, {}) };
}

export const TONE_PRESETS = {
  FRIENDLY: "Warm and friendly, conversational, like texting a client you know. Short sentences.",
  DIRECT: "Direct and numbers-first. Professional and confident. No fluff.",
  CONSULTATIVE: "Polished and consultative. Educational, calm, reassuring.",
} as const;
export type TonePreset = keyof typeof TONE_PRESETS | "CUSTOM";

export function toneOf(b: Pick<Broker, "tonePreset" | "toneCustom">): string {
  if (b.tonePreset === "CUSTOM" && b.toneCustom) return b.toneCustom;
  return TONE_PRESETS[(b.tonePreset as keyof typeof TONE_PRESETS) ?? "FRIENDLY"] ?? TONE_PRESETS.FRIENDLY;
}

/** Engine context for a broker: their program grid + state defaults with overrides. */
export function engineContext(b: Pick<Broker, "programGrid" | "stateOverrides">): EngineContext {
  const overrides = parseJson<Partial<Record<UsState, Partial<StateDefault>>>>(b.stateOverrides, {});
  const stateDefaults = { ...STATE_DEFAULTS };
  for (const [k, v] of Object.entries(overrides)) {
    const key = k as UsState;
    if (stateDefaults[key] && v) stateDefaults[key] = { ...stateDefaults[key], ...v };
  }
  return { grid: normalizeGrid(parseJson(b.programGrid, {})), stateDefaults };
}

export function moneyListRules(b: Pick<Broker, "moneyListRules">): MoneyListRules {
  const r = parseJson<Partial<MoneyListRules>>(b.moneyListRules, {});
  return { ...DEFAULT_MONEY_LIST_RULES, ...r, seasoningMonths: { ...DEFAULT_MONEY_LIST_RULES.seasoningMonths, ...(r.seasoningMonths ?? {}) }, enabled: { ...DEFAULT_MONEY_LIST_RULES.enabled, ...(r.enabled ?? {}) } };
}

export const licensedStates = (b: Pick<Broker, "licensedStates">) => parseJson<string[]>(b.licensedStates, []);
export const notificationEmails = (b: Pick<Broker, "notificationEmails" | "email">) => {
  const list = parseJson<string[]>(b.notificationEmails, []);
  return list.length ? list : [b.email];
};

/** Everything a public page, PDF or email needs to brand itself. No secrets. */
export interface PublicBrand {
  brokerId: string;
  slug: string;
  /** Visual theme (src/design). Every public page, PDF and email follows it. */
  theme: ThemeId;
  companyName: string;
  companyNmlsId: string;
  logoUrl: string | null;
  accentColor: string;
  accentText: string;
  onAccent: string;
  phone: string | null;
  email: string;
  websiteUrl: string | null;
  privacyPolicyUrl: string | null;
  licensedStates: string[];
  disclaimer: { id: string | null; version: number; text: string };
  lo: { id: string | null; slug: string | null; name: string; title: string; nmlsId: string | null; phone: string | null; email: string; headshotUrl: string | null };
  isDemo: boolean;
}

export function toPublicBrand(b: Broker, lo: User | null, disclaimer: DisclaimerVersion | null): PublicBrand {
  const th = getTheme(b.theme, b.accentColor);
  const p = { accent: th.color.accent, accentText: th.color.accentText, onAccent: th.color.onAccent };
  return {
    brokerId: b.id,
    slug: b.slug,
    theme: th.id,
    companyName: b.companyName,
    companyNmlsId: b.companyNmlsId,
    logoUrl: b.logoUrl,
    accentColor: p.accent,
    accentText: p.accentText,
    onAccent: p.onAccent,
    phone: lo?.phone ?? b.phone,
    email: lo?.email ?? b.email,
    websiteUrl: b.websiteUrl,
    privacyPolicyUrl: b.privacyPolicyUrl,
    licensedStates: licensedStates(b),
    disclaimer: { id: disclaimer?.id ?? null, version: disclaimer?.version ?? 0, text: disclaimer?.text ?? DEFAULT_DISCLAIMER },
    lo: {
      id: lo?.id ?? null,
      slug: lo?.slug ?? null,
      name: lo?.name ?? b.companyName,
      title: lo?.title ?? "Loan Officer",
      nmlsId: lo?.nmlsId ?? null,
      phone: lo?.phone ?? b.phone,
      email: lo?.email ?? b.email,
      headshotUrl: lo?.headshotUrl ?? null,
    },
    isDemo: b.isDemo,
  };
}

/** Resolve a public page's broker + LO. Returns { unavailable } for suspended brokers or disabled modules. */
export async function getPublicContext(slug: string, opts: { loSlug?: string | null; loId?: string | null; feature?: FeatureKey } = {}) {
  const broker = await prisma.broker.findUnique({ where: { slug } });
  if (!broker) return null;
  if (broker.status === "SUSPENDED" || (opts.feature && !features(broker)[opts.feature])) return { unavailable: true as const, broker };
  const lo =
    (opts.loId ? await prisma.user.findFirst({ where: { id: opts.loId, brokerId: broker.id, active: true } }) : null) ??
    (opts.loSlug ? await prisma.user.findFirst({ where: { slug: opts.loSlug, brokerId: broker.id, active: true } }) : null) ??
    (broker.primaryUserId ? await prisma.user.findUnique({ where: { id: broker.primaryUserId } }) : null) ??
    (await prisma.user.findFirst({ where: { brokerId: broker.id, active: true }, orderBy: { createdAt: "asc" } }));
  const disclaimer = broker.currentDisclaimerId ? await forBroker(broker.id).disclaimerVersion.findFirst({ where: { id: broker.currentDisclaimerId } }) : null;
  return { unavailable: false as const, broker, lo, disclaimer, brand: toPublicBrand(broker, lo, disclaimer), ctx: engineContext(broker) };
}

/** Brand for a dashboard user's outgoing messages (the signed-in LO, else the broker's primary LO). */
export async function staffBrand(broker: Broker, user: User | null) {
  const lo =
    (user && user.brokerId === broker.id ? user : null) ??
    (broker.primaryUserId ? await prisma.user.findUnique({ where: { id: broker.primaryUserId } }) : null) ??
    (await prisma.user.findFirst({ where: { brokerId: broker.id, active: true }, orderBy: { createdAt: "asc" } }));
  const disclaimer = broker.currentDisclaimerId ? await forBroker(broker.id).disclaimerVersion.findFirst({ where: { id: broker.currentDisclaimerId } }) : null;
  return toPublicBrand(broker, lo, disclaimer);
}
