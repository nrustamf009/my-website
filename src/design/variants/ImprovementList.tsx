"use client";

import { useTheme } from "../ThemeContext";

export interface Improvement {
  /** Short signed change, already formatted ("+$79/mo", "−0.375%", "+$9,802"). */
  delta: string;
  /** Optional unit shown smaller after the delta ("/mo"). */
  unit?: string;
  label: string;
  hint: string;
  stretch?: boolean;
}

const ROMAN = ["i.", "ii.", "iii.", "iv."];

/** Theme-branching (DESIGN.md §6): "paths to 1.20". maison roman ordinals · terminal mono deltas · atelier giant deltas. */
export function ImprovementList({ items, stretchLabel }: { items: Improvement[]; stretchLabel: string }) {
  const { variants } = useTheme();
  const style = variants.verdict; // italic → maison, chip → terminal, sentence → atelier
  return (
    <ol className="border-t border-rule">
      {items.map((it, i) => (
        <li key={it.label} className={`flex items-start gap-4 border-b border-rule ${style === "sentence" ? "py-5" : "py-4"}`}>
          <span
            className={
              style === "italic"
                ? "w-8 shrink-0 font-display text-2xl italic text-accent"
                : style === "chip"
                  ? "num w-24 shrink-0 font-mono text-base font-medium text-accent"
                  : "num w-[46%] shrink-0 whitespace-nowrap font-display text-[length:min(var(--type-option-rate-size),8.5vw)] font-bold leading-none tracking-tight text-ink"
            }
          >
            {style === "italic" ? ROMAN[i] : it.delta}
            {style !== "italic" && it.unit && <span className={style === "sentence" ? "text-[length:var(--type-body-size)]" : ""}>{it.unit}</span>}
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-ink">{style === "italic" ? it.label : it.label}</span>
            <span className="type-body-small block text-muted">
              {style === "italic" ? `${it.delta}${it.unit ?? ""} · ${it.hint}` : it.hint}
              {it.stretch ? ` · ${stretchLabel}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
