import { deriveAccent, luminance } from "../accent";
import { getThemeDefinition, PLATFORM_THEME } from "../index";

/**
 * Inline-style values for React Email (DESIGN.md §10). The system fallback stacks are the real design
 * (Gmail strips web fonts); the web font is listed first as a progressive enhancement.
 */
export function getEmailTheme(id: unknown, accentHex?: string | null) {
  const def = getThemeDefinition(id);
  const c = def.tokens.color;
  const dark = def.email.dark;
  const card = dark ? c.surface : c.surface;
  const canvas = dark ? c.bg : c.surfaceAlt;
  const a = deriveAccent(accentHex || def.defaultAccent, { bg: card, surface: card, ink: c.ink, onAccentCandidates: [c.ink, c.bg] });
  const accent = a.ok ? a : deriveAccent(def.defaultAccent, { bg: card, surface: card, ink: c.ink, onAccentCandidates: [c.ink, c.bg] });
  const web: Record<string, string | null> = { instrumentSerif: "'Instrument Serif'", hankenGrotesk: "'Hanken Grotesk'", plexSans: "'IBM Plex Sans'", plexMono: "'IBM Plex Mono'", interTight: "'Inter Tight'", system: null, systemMono: null };
  const stack = (slot: "display" | "body" | "mono") => [web[def.families[slot]], def.stacks[slot]].filter(Boolean).join(", ");
  return {
    id: def.id,
    dark,
    color: { canvas, card, panel: dark ? c.surfaceAlt : c.bg, ink: c.ink, ink2: c.ink2, muted: c.muted, rule: c.rule, accent: accent.accent, accentText: accent.accentText, onAccent: accent.onAccent, positive: c.positive, inverse: c.inverse, onInverse: c.onInverse },
    font: { display: stack("display"), body: stack("body"), mono: stack("mono") },
    numeral: { weight: def.tokens.type.heroNumeral.weight, italic: def.tokens.type.optionLetter.italic === true },
    radius: { card: def.tokens.radius.card, control: def.tokens.radius.control },
    googleFonts: dark || luminance(c.bg) > 0 ? fontLink(def.families) : null,
  };
}

function fontLink(f: { display: string; body: string; mono: string }) {
  const q: Record<string, string> = { instrumentSerif: "Instrument+Serif:ital@0;1", hankenGrotesk: "Hanken+Grotesk:wght@400;600", plexSans: "IBM+Plex+Sans:wght@400;600", plexMono: "IBM+Plex+Mono:wght@400;500", interTight: "Inter+Tight:wght@400;600;700" };
  const fams = Array.from(new Set([f.display, f.body, f.mono])).map((k) => q[k]).filter(Boolean);
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.map((x) => `family=${x}`).join("&")}&display=swap` : null;
}

export type EmailTheme = ReturnType<typeof getEmailTheme>;
export const platformEmailTheme = () => getEmailTheme(PLATFORM_THEME.id, PLATFORM_THEME.accent);
