import type { FontFamilyKey } from "./tokens";

/** CSS custom properties set by next/font (fonts.ts) for each web family. System stacks have none. */
export const FONT_VARS: Partial<Record<FontFamilyKey, string>> = {
  instrumentSerif: "--ff-instrument-serif",
  hankenGrotesk: "--ff-hanken-grotesk",
  plexSans: "--ff-plex-sans",
  plexMono: "--ff-plex-mono",
  interTight: "--ff-inter-tight",
};
