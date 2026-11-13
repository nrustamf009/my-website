import localFont from "next/font/local";
import type { FontFamilyKey, ThemeId } from "./tokens";
import { THEMES } from "./themes-registry";
import { FONT_VARS } from "./font-vars";

/**
 * Self-hosted (src/design/fonts, downloaded once by `npm run design:fonts`) so builds never depend on
 * Google Fonts. All families use preload: false; only the active theme's variable classes are put on
 * the theme wrapper, so the browser downloads only that theme's files.
 */
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-400-italic.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-instrument-serif",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
const hankenGrotesk = localFont({
  src: [
    { path: "./fonts/hanken-grotesk-400.woff2", weight: "400" },
    { path: "./fonts/hanken-grotesk-500.woff2", weight: "500" },
    { path: "./fonts/hanken-grotesk-600.woff2", weight: "600" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-hanken-grotesk",
  fallback: ["system-ui", "sans-serif"],
});
const plexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-400.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-500.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-sans-600.woff2", weight: "600" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-plex-sans",
  fallback: ["system-ui", "sans-serif"],
});
const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-plex-mono",
  fallback: ["ui-monospace", "Menlo", "monospace"],
});
const interTight = localFont({
  src: [
    { path: "./fonts/inter-tight-400.woff2", weight: "400" },
    { path: "./fonts/inter-tight-500.woff2", weight: "500" },
    { path: "./fonts/inter-tight-600.woff2", weight: "600" },
    { path: "./fonts/inter-tight-700.woff2", weight: "700" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-inter-tight",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

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
