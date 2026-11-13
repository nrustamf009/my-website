/**
 * Accent → accessible palette. Brokers pick any color; we derive tints/shades and an
 * AA-compliant foreground. If the accent itself fails AA as text on white, a darkened
 * "accentText" is used for text/links while the raw accent stays for fills.
 */
type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [31, 78, 121];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbToHex = ([r, g, b]: RGB) => "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

export const mix = (a: string, b: string, t: number) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};

export interface Palette {
  accent: string;
  /** Text color on top of an accent fill (white or ink), AA compliant. */
  onAccent: string;
  /** Accent usable as text/links on white (darkened until AA ≥ 4.5). */
  accentText: string;
  tint50: string;
  tint100: string;
  tint200: string;
  shade700: string;
  /** True when the raw accent was adjusted for accessibility. */
  adjusted: boolean;
}

const INK = "#17150f";

export function paletteFor(accent: string): Palette {
  const a = /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : "#1f4e79";
  const onAccent = contrast(a, "#ffffff") >= 4.5 ? "#ffffff" : contrast(a, INK) >= 4.5 ? INK : contrast(a, "#ffffff") >= contrast(a, INK) ? "#ffffff" : INK;
  let accentText = a;
  let i = 0;
  while (contrast(accentText, "#ffffff") < 4.5 && i < 20) {
    accentText = mix(accentText, "#000000", 0.08);
    i++;
  }
  return {
    accent: a,
    onAccent,
    accentText,
    tint50: mix(a, "#ffffff", 0.95),
    tint100: mix(a, "#ffffff", 0.9),
    tint200: mix(a, "#ffffff", 0.72),
    shade700: mix(a, "#000000", 0.25),
    adjusted: accentText !== a,
  };
}

/** CSS variables consumed by globals.css utility classes. */
export function paletteVars(accent: string): Record<string, string> {
  const p = paletteFor(accent);
  return {
    "--accent": p.accent,
    "--accent-ink": p.onAccent,
    "--accent-text": p.accentText,
    "--accent-faint": p.tint50,
    "--accent-soft": p.tint100,
    "--accent-line": p.tint200,
    "--accent-deep": p.shade700,
  };
}
