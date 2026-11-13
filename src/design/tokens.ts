/** The semantic contract every theme fills (DESIGN.md §3.2 + additions in docs/DESIGN-PLAN.md §3). */
export const THEME_IDS = ["maison", "terminal", "atelier"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const isThemeId = (v: unknown): v is ThemeId => typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);

export type FontFamilyKey = "instrumentSerif" | "hankenGrotesk" | "plexSans" | "plexMono" | "interTight" | "system" | "systemMono";

export const TYPE_ROLES = ["heroNumeral", "dashboardCount", "h1", "h1Desktop", "section", "metric", "metricPanel", "optionRate", "optionLetter", "eyebrow", "body", "bodySmall", "button", "fine"] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];

export interface TypeSpec {
  family: "display" | "body" | "mono";
  /** px */
  size: number;
  /** px */
  line: number;
  /** em */
  tracking: number;
  weight: number;
  italic?: boolean;
  upper?: boolean;
}

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  inverse: string;
  onInverse: string;
  onInverseMuted: string;
  inverseRule: string;
  ink: string;
  ink2: string;
  muted: string;
  dim: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accentText: string;
  onAccent: string;
  accentTint: string;
  warn: string;
  onWarn: string;
  positive: string;
  negative: string;
  focus: string;
}

export interface ThemeTokens {
  color: ColorTokens;
  font: { display: string; body: string; mono: string };
  type: Record<TypeRole, TypeSpec>;
  radius: { card: number; tile: number; control: number; cta: number; badge: number; logo: number };
  border: { hairline: number; strong: number };
  space: { page: number; section: number };
  /** Box shadow for raised surfaces; "none" in all three themes (depth comes from surfaces and rules). */
  shadow: string;
}

export interface ThemeVariants {
  meter: "linear" | "gauge" | "linear-block";
  verdict: "italic" | "chip" | "sentence";
  options: "stacked" | "table" | "sections";
  shell: "sidebar-dark" | "sidebar-bordered" | "topbar";
  iconStroke: 1.5 | 2;
  monogram: "outline-square" | "solid-rounded" | "wordmark";
  /** Section headings prefixed with 01, 02 … */
  numberedSections: boolean;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  fits: string;
  /** Default accent and the four presets offered in Settings → Appearance. */
  defaultAccent: string;
  presets: [string, string, string, string];
  /** Fonts this theme downloads (see fonts.ts). */
  families: { display: FontFamilyKey; body: FontFamilyKey; mono: FontFamilyKey };
  /** CSS fallback stacks after the web font. */
  stacks: { display: string; body: string; mono: string };
  tokens: Omit<ThemeTokens, "font">;
  variants: ThemeVariants;
  /** Light "paper" palette for PDFs (terminal prints light on purpose). */
  pdf: { paper: string; ink: string; muted: string; rule: string; panel: string; band: string; onBand: string };
  email: { dark: boolean };
}
