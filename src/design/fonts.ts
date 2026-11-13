import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif, Hanken_Grotesk, Inter_Tight } from "next/font/google";
import type { FontFamilyKey, ThemeId } from "./tokens";
import { THEMES } from "./themes-registry";
import { FONT_VARS } from "./font-vars";

/**
 * All five families are declared with preload: false. Only the active theme's variable classes are
 * put on the theme wrapper, so the browser downloads only that theme's files (verified by
 * tests/e2e/design-fonts.spec.ts). adjustFontFallback keeps the swap from shifting layout.
 */
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap", preload: false, variable: "--ff-instrument-serif" });
const hankenGrotesk = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: false, variable: "--ff-hanken-grotesk" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: false, variable: "--ff-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", preload: false, variable: "--ff-plex-mono" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false, variable: "--ff-inter-tight" });

const FAMILY: Record<Exclude<FontFamilyKey, "system" | "systemMono">, { variable: string }> = {
  instrumentSerif: { variable: instrumentSerif.variable },
  hankenGrotesk: { variable: hankenGrotesk.variable },
  plexSans: { variable: plexSans.variable },
  plexMono: { variable: plexMono.variable },
  interTight: { variable: interTight.variable },
};

/** Class names that define the theme's font variables (and nothing else). */
export function themeFontClasses(id: ThemeId): string {
  const f = THEMES[id].families;
  return Array.from(new Set([f.display, f.body, f.mono]))
    .filter((k): k is keyof typeof FAMILY => k in FAMILY)
    .map((k) => FAMILY[k].variable)
    .join(" ");
}

export { FONT_VARS };
