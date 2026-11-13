import { contrast, deriveAccent, ensureContrast, mix } from "../accent";
import { getThemeDefinition } from "../index";
import type { FontFamilyKey, ThemeId } from "../tokens";

/** react-pdf family names registered in fonts.ts; system stacks map to the built-in PDF fonts. */
export const PDF_FAMILY: Record<FontFamilyKey, string> = {
  instrumentSerif: "InstrumentSerif",
  hankenGrotesk: "HankenGrotesk",
  plexSans: "PlexSans",
  // fontkit cannot lay out IBM Plex Mono (GPOS); PDFs use the built-in Courier for terminal numerals.
  plexMono: "Courier",
  interTight: "InterTight",
  system: "Helvetica",
  systemMono: "Courier",
};

/**
 * Plain object for @react-pdf/renderer (no CSS variables). Print is always light; colors are re-checked
 * for AA on the paper, so terminal's dark-tuned greens and ambers darken automatically.
 */
export function getPdfTheme(id: unknown, accentHex?: string | null) {
  const def = getThemeDefinition(id);
  const p = def.pdf;
  const c = def.tokens.color;
  const onPaper = (hex: string) => ensureContrast(hex, [p.paper, p.panel], 4.5);
  const a = deriveAccent(accentHex || def.defaultAccent, { bg: p.paper, surface: p.panel, ink: p.ink, onAccentCandidates: [p.ink] });
  const accent = a.ok ? a : deriveAccent(def.defaultAccent, { bg: p.paper, surface: p.panel, ink: p.ink, onAccentCandidates: [p.ink] });
  const positive = onPaper(c.positive);
  const negative = onPaper(c.negative);
  const warn = onPaper(c.warn);
  const ink2 = contrast(c.ink2, p.paper) >= 7 ? c.ink2 : mix(p.ink, p.paper, 0.18);
  return {
    id: def.id as ThemeId,
    flags: { headerBand: p.headerBand, compareBlock: p.compareBlock },
    color: {
      paper: p.paper,
      panel: p.panel,
      ink: p.ink,
      ink2,
      muted: p.muted,
      rule: p.rule,
      band: p.band,
      onBand: p.onBand,
      accent: accent.accent,
      accentText: accent.accentText,
      onAccent: accent.onAccent,
      accentTint: mix(p.paper, accent.accent, 0.1),
      positive,
      positiveTint: mix(p.paper, positive, 0.1),
      negative,
      negativeTint: mix(p.paper, negative, 0.1),
      warn,
      warnTint: mix(p.paper, warn, 0.12),
    },
    font: { display: PDF_FAMILY[def.families.display], body: PDF_FAMILY[def.families.body], mono: PDF_FAMILY[def.families.mono] },
    displayItalic: def.tokens.type.optionLetter.italic === true,
    displayWeight: def.tokens.type.heroNumeral.weight,
    /** px → pt (×0.75) */
    radius: { card: def.tokens.radius.card * 0.75, control: def.tokens.radius.control * 0.75 },
    rule: { hairline: def.tokens.border.hairline * 0.75, strong: def.tokens.border.strong * 0.75 },
  };
}

export type PdfTheme = ReturnType<typeof getPdfTheme>;
