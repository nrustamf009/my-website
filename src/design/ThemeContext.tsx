"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ThemeId, ThemeVariants } from "./tokens";

const Ctx = createContext<{ id: ThemeId; variants: ThemeVariants } | null>(null);

export function ThemeContextProvider({ id, variants, children }: { id: ThemeId; variants: ThemeVariants; children: ReactNode }) {
  return <Ctx.Provider value={{ id, variants }}>{children}</Ctx.Provider>;
}

/** Theme id and variant flags for client components. Only the six variant components may branch on these. */
export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme() must be used inside <ThemeScope>");
  return v;
}
