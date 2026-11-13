import { atelier } from "./themes/atelier";
import { maison } from "./themes/maison";
import { terminal } from "./themes/terminal";
import type { ThemeDefinition, ThemeId } from "./tokens";

export const THEMES: Record<ThemeId, ThemeDefinition> = { maison, terminal, atelier };
