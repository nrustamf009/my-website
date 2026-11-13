import { deriveAccent, type DerivedAccent } from "./accent";
import { THEMES } from "./themes-registry";
import { THEME_IDS, isThemeId, type ThemeDefinition, type ThemeId, type ThemeTokens } from "./tokens";

export * from "./tokens";
export { contrast } from "./accent";

export { THEMES };
export const themeIds = THEME_IDS;

/** Platform pages (landing, sign-in) and the agency admin use fixed themes (docs/DECISIONS.md). */
export const PLATFORM_THEME: { id: ThemeId; accent: string } = { id: "maison", accent: "#10241D" };
export const ADMIN_THEME: { id: ThemeId; accent: string } = { id: "terminal", accent: "#E9EDF0" };

export function getThemeDefinition(id: unknown): ThemeDefinition {
  return THEMES[isThemeId(id) ? id : "maison"];
}

export function accentFor(def: ThemeDefinition, hex: string | null | undefined): DerivedAccent {
  const c = def.tokens.color;
  return deriveAccent(hex || def.defaultAccent, { bg: c.bg, surface: c.surface, ink: c.ink, onAccentCandidates: [c.ink, c.bg] });
}

/** Resolve a theme with the broker's accent. Falls back to the theme default if the accent is unusable. */
export function getTheme(id: unknown, accentHex?: string | null): ThemeTokens & { id: ThemeId; def: ThemeDefinition; accentAdjusted: boolean } {
  const def = getThemeDefinition(id);
  let a = accentFor(def, accentHex);
  const fellBack = !a.ok;
  if (!a.ok) a = accentFor(def, def.defaultAccent);
  const fonts = { display: `${def.stacks.display}`, body: `${def.stacks.body}`, mono: `${def.stacks.mono}` };
  return {
    ...def.tokens,
    id: def.id,
    def,
    font: fonts,
    color: { ...def.tokens.color, accent: a.accent, onAccent: a.onAccent, accentText: a.accentText, accentTint: a.accentTint },
    accentAdjusted: fellBack || a.accentText !== a.accent,
  };
}

/** Per-broker CSS variables written inline on the theme wrapper (static tokens live in theme.css). */
export function accentVars(id: unknown, accentHex?: string | null): Record<string, string> {
  const t = getTheme(id, accentHex);
  return { "--accent": t.color.accent, "--accent-text": t.color.accentText, "--on-accent": t.color.onAccent, "--accent-tint": t.color.accentTint };
}

/** Settings → Appearance validation. */
export function checkAccent(id: unknown, hex: string) {
  return accentFor(getThemeDefinition(id), hex);
}
