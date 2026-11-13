import { THEMES, type ThemeId } from "../index";
import { FONT_VARS } from "../font-vars";

/** Small preview of a theme for the Appearance picker, drawn from the theme's own tokens. */
export function ThemeSwatch({ id }: { id: ThemeId }) {
  const t = THEMES[id];
  const c = t.tokens.color;
  return (
    <div className="flex h-20 items-end gap-2 p-3" style={{ background: c.inverse }}>
      <span className="text-3xl leading-none" style={{ color: c.onInverse, fontFamily: `var(${FONT_VARS[t.families.display] ?? "--font-display"}), ${t.stacks.display}`, fontWeight: t.tokens.type.heroNumeral.weight }}>
        1.17
      </span>
      <span className="mb-1 h-2 flex-1" style={{ background: t.defaultAccent }} />
    </div>
  );
}
