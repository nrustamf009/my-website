import { describe, expect, it } from "vitest";
import { contrast, deriveAccent, ensureContrast, mix, oklchToRgb, parseHex, rgbToOklch, toHex } from "../accent";
import { THEMES, checkAccent, getTheme } from "../index";
import { TYPE_ROLES } from "../tokens";

describe("OKLCH conversion", () => {
  it("round-trips sRGB hex through OKLCH", () => {
    for (const hex of ["#7D5E22", "#5FE3B3", "#2233E6", "#FFFFFF", "#000000", "#10241D", "#D42C16"]) {
      expect(toHex(oklchToRgb(rgbToOklch(parseHex(hex)!)))).toBe(hex);
    }
  });
  it("known WCAG contrast values", () => {
    expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("mix(a, b, 0) = a and mix(a, b, 1) = b", () => {
    expect(mix("#123456", "#ABCDEF", 0)).toBe("#123456");
    expect(mix("#123456", "#ABCDEF", 1)).toBe("#ABCDEF");
  });
});

describe("accent engine (DESIGN.md §8)", () => {
  for (const def of Object.values(THEMES)) {
    const c = def.tokens.color;
    for (const preset of def.presets) {
      it(`${def.id} preset ${preset}: onAccent ≥ 4.5, accentText ≥ 4.5 on bg and surface`, () => {
        const a = checkAccent(def.id, preset);
        expect(a.ok).toBe(true);
        expect(contrast(a.onAccent, a.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(a.accentText, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(a.accentText, c.surface)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("pale yellow on atelier: white text is refused, ink text and a darkened accentText are derived", () => {
    const a = checkAccent("atelier", "#FFE45C");
    // Pale yellow takes ink text (≥ 4.5) for fills; white text alone would fail.
    expect(contrast("#FFFFFF", "#FFE45C")).toBeLessThan(4.5);
    expect(a.onAccent).not.toBe("#FFFFFF");
    expect(contrast(a.accentText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5); // darkened for text
  });
  it("rejects a mid-gray that neither white nor ink can sit on", () => {
    const a = deriveAccent("#808080", { bg: "#FFFFFF", surface: "#FFFFFF", ink: "#777777", onAccentCandidates: ["#888888"] });
    expect(a.ok).toBe(false);
    expect(a.reason).toMatch(/hard to read/);
  });
  it("accentText lightens on dark themes and keeps the hue", () => {
    const dark = ensureContrast("#2233E6", ["#0A0C0F", "#12161B"]);
    expect(contrast(dark, "#0A0C0F")).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(rgbToOklch(parseHex(dark)!).h - rgbToOklch(parseHex("#2233E6")!).h)).toBeLessThan(6);
  });
  it("falls back to the theme default for an unusable accent", () => {
    expect(getTheme("terminal", "not-a-color").color.accent).toBe("#5FE3B3");
  });
});

describe("theme tokens are accessible and complete", () => {
  for (const def of Object.values(THEMES)) {
    const c = def.tokens.color;
    it(`${def.id}: body text, muted, status colors ≥ 4.5:1 on bg, surface and surfaceAlt`, () => {
      for (const fg of [c.ink, c.ink2, c.muted, c.positive, c.negative, c.warn]) for (const bg of [c.bg, c.surface, c.surfaceAlt]) expect([fg, bg, contrast(fg, bg) >= 4.5]).toEqual([fg, bg, true]);
      expect(contrast(c.onInverse, c.inverse)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.onInverseMuted, c.inverse)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.onWarn, c.warn)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.focus, c.bg)).toBeGreaterThanOrEqual(3);
    });
    it(`${def.id}: every type role defined`, () => {
      for (const r of TYPE_ROLES) expect(def.tokens.type[r].size).toBeGreaterThan(0);
    });
  }
});
