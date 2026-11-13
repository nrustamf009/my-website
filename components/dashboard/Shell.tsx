import type { ReactNode } from "react";
import type { NavItem } from "./Nav";
import { signOutAction } from "@/lib/actions/auth";
import { ThemeScope } from "@design/ThemeScope";
import { DashboardShell, type ShellBrand } from "@design/variants/DashboardShell";

/** Dashboard and admin chrome: the broker's theme (or the fixed admin theme) applied via ThemeScope. */
export function Shell({ items, brand, banner, theme, accent, userLabel, children }: { items: NavItem[]; brand: ShellBrand; banner?: ReactNode; theme: string; accent?: string | null; userLabel: string; children: ReactNode }) {
  return (
    <ThemeScope theme={theme} accent={accent} paintRoot>
      <DashboardShell items={items} brand={brand} banner={banner} userLabel={userLabel} signOut={signOutAction}>
        {children}
      </DashboardShell>
    </ThemeScope>
  );
}
