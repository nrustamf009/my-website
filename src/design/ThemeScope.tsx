import type { CSSProperties, ReactNode } from "react";
import { accentVars, getTheme, getThemeDefinition } from "./index";
import { themeFontClasses } from "./fonts";
import { luminance } from "./accent";
import { ThemeContextProvider } from "./ThemeContext";

/**
 * Server-resolved theme boundary (DESIGN.md §3.3). Sets data-theme (static tokens from theme.css),
 * the broker's derived accent variables, and the theme's font variables, so there is no flash of
 * the wrong theme and only that theme's fonts are downloaded.
 */
export function ThemeScope({ theme, accent, children, className, fill = true, paintRoot = false }: { theme: unknown; accent?: string | null; children: ReactNode; className?: string; fill?: boolean; paintRoot?: boolean }) {
  const def = getThemeDefinition(theme);
  const t = getTheme(def.id, accent);
  return (
    <div data-theme={def.id} className={[themeFontClasses(def.id), "bg-page text-ink font-sans", fill ? "min-h-screen" : "", className ?? ""].join(" ").trim()} style={accentVars(def.id, accent) as CSSProperties}>
      {/* The page canvas outside this element (overscroll, embeds) matches the theme. */}
      {paintRoot && <style>{`html,body{background:${t.color.bg};color-scheme:${luminance(t.color.bg) < 0.18 ? "dark" : "light"}}`}</style>}
      <ThemeContextProvider id={def.id} variants={def.variants}>
        {children}
      </ThemeContextProvider>
    </div>
  );
}
