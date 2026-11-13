/**
 * White-label accent engine (DESIGN.md §8). Works in OKLCH so lightness changes keep the
 * broker's hue and chroma. Contrast is WCAG 2.x relative-luminance contrast.
 */
export type Rgb = [number, number, number]; // 0..1 sRGB
export interface Oklch { l: number; c: number; h: number }

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function toHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function rgbToOklch(rgb: Rgb): Oklch {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  return { l: L, c, h: c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l_ = Math.pow(l + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m_ = Math.pow(l - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s_ = Math.pow(l - 0.0894841775 * A - 1.291485548 * B, 3);
  return [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
}

/** OKLCH → sRGB, reducing chroma until the color is inside the sRGB gamut. */
export function oklchToRgb(o: Oklch): Rgb {
  let c = o.c;
  for (let i = 0; i < 40; i++) {
    const lin = oklchToLinear({ ...o, c });
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) return lin.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb;
    c *= 0.92;
  }
  return oklchToLinear({ ...o, c: 0 }).map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb;
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix in OKLab (perceptual), t = share of `b`. Used for tints over the page background. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a) ?? [0, 0, 0];
  const y = parseHex(b) ?? [0, 0, 0];
  const lab = (rgb: Rgb) => {
    const o = rgbToOklch(rgb);
    return [o.l, o.c * Math.cos((o.h * Math.PI) / 180), o.c * Math.sin((o.h * Math.PI) / 180)];
  };
  const [l1, a1, b1] = lab(x);
  const [l2, a2, b2] = lab(y);
  const L = l1! + (l2! - l1!) * t;
  const A = a1! + (a2! - a1!) * t;
  const B = b1! + (b2! - b1!) * t;
  return toHex(oklchToRgb({ l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }));
}

/**
 * Move a color's OKLCH lightness (hue and chroma kept) until it reaches `target` contrast
 * against every background. Direction: away from the backgrounds' lightness.
 */
export function ensureContrast(hex: string, backgrounds: string[], target = 4.5): string {
  const ok = (h: string) => backgrounds.every((bg) => contrast(h, bg) >= target);
  if (ok(hex)) return hex.toUpperCase();
  const base = rgbToOklch(parseHex(hex) ?? [0, 0, 0]);
  const darkBg = backgrounds.every((bg) => luminance(bg) < 0.18);
  for (let i = 1; i <= 100; i++) {
    const l = darkBg ? Math.min(1, base.l + i * 0.01) : Math.max(0, base.l - i * 0.01);
    const cand = toHex(oklchToRgb({ ...base, l }));
    if (ok(cand)) return cand;
  }
  return darkBg ? "#FFFFFF" : "#000000";
}

export interface AccentInput {
  bg: string;
  surface: string;
  ink: string;
  /** Text color tried on accent fills besides white (usually the theme's ink or bg). */
  onAccentCandidates: string[];
}

export interface DerivedAccent {
  accent: string;
  onAccent: string;
  accentText: string;
  accentTint: string;
  /** Contrast of onAccent on accent, and of accentText on bg (for the Appearance readout). */
  ratios: { onAccent: number; accentTextOnBg: number; accentTextOnSurface: number };
  ok: boolean;
  reason?: string;
}

export function deriveAccent(hex: string, t: AccentInput): DerivedAccent {
  const rgb = parseHex(hex);
  const accent = rgb ? toHex(rgb) : "#000000";
  if (!rgb) return { accent, onAccent: "#FFFFFF", accentText: t.ink, accentTint: t.surface, ratios: { onAccent: 0, accentTextOnBg: 0, accentTextOnSurface: 0 }, ok: false, reason: "Use a hex color like #1F4E79." };
  const candidates = ["#FFFFFF", ...t.onAccentCandidates];
  const best = candidates.map((c) => ({ c, r: contrast(c, accent) })).sort((a, b) => b.r - a.r)[0]!;
  const accentText = ensureContrast(accent, [t.bg, t.surface], 4.5);
  const accentTint = mix(t.bg, accent, luminance(t.bg) < 0.18 ? 0.16 : 0.1);
  const ok = best.r >= 4.5;
  return {
    accent,
    onAccent: best.c.toUpperCase(),
    accentText,
    accentTint,
    ratios: { onAccent: round(best.r), accentTextOnBg: round(contrast(accentText, t.bg)), accentTextOnSurface: round(contrast(accentText, t.surface)) },
    ok,
    reason: ok ? undefined : "White and dark text are both hard to read on this color. Pick a darker or more saturated shade.",
  };
}

const round = (n: number) => Number(n.toFixed(2));
