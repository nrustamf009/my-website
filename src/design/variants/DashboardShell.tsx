"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, MobileBar, type NavItem } from "@/components/dashboard/Nav";
import { BrokerMark } from "../components/primitives";
import { useTheme } from "../ThemeContext";

export interface ShellBrand {
  name: string;
  subtitle: string;
  logoUrl: string | null;
}

const isActive = (path: string, href: string) => href === path || (href !== "/dashboard" && href !== "/admin" && path.startsWith(href));

function BrandBlock({ brand, tone }: { brand: ShellBrand; tone: "page" | "inverse" }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrokerMark logoUrl={brand.logoUrl} name={brand.name} size={36} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{brand.name}</div>
        <div className={`type-body-small truncate ${tone === "inverse" ? "text-on-inverse-muted" : "text-muted"}`}>{brand.subtitle}</div>
      </div>
    </div>
  );
}

/**
 * Theme-branching (DESIGN.md §6). maison: dark 232px sidebar, current item light with a display count ·
 * terminal: bordered 208px sidebar, current item raised with an accent badge · atelier: top bar with a
 * 2px rule and an underlined current item. Phones always get the compact bar + menu.
 */
export function DashboardShell({ items, brand, userLabel, signOut, banner, children }: { items: NavItem[]; brand: ShellBrand; userLabel: string; signOut: () => Promise<void>; banner?: ReactNode; children: ReactNode }) {
  const { variants } = useTheme();
  const path = usePathname();
  const mobile = <MobileBar items={items} header={<BrandBlock brand={brand} tone="page" />} userLabel={userLabel} signOut={signOut} />;
  const signOutForm = (cls: string) => (
    <form action={signOut}>
      <button className={cls}>Sign out</button>
    </form>
  );

  if (variants.shell === "topbar") {
    return (
      <>
        {banner}
        {mobile}
        <header className="sticky top-0 z-30 hidden border-b-2 border-ink bg-page md:block">
          <div className="flex items-center gap-8 px-8">
            <div className="py-3"><BrandBlock brand={brand} tone="page" /></div>
            <nav className="flex flex-1 flex-wrap items-center gap-x-6" aria-label="Main">
              {items.map((it) => (
                <Link key={it.href} href={it.href} aria-current={isActive(path, it.href) ? "page" : undefined} className={`flex items-center gap-1.5 border-b-2 py-4 text-sm ${isActive(path, it.href) ? "border-ink font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
                  {it.label}
                  {it.badge ? <span className="font-bold text-accent">{it.badge}</span> : null}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-4 text-sm text-ink-2">
              <span className="max-w-48 truncate">{userLabel}</span>
              {signOutForm("font-medium text-ink underline underline-offset-4")}
            </div>
          </div>
        </header>
        <main className="min-w-0 animate-rise px-[var(--space-page)] py-6 sm:px-8 sm:py-8">{children}</main>
      </>
    );
  }

  const dark = variants.shell === "sidebar-dark";
  return (
    <>
      {banner}
      {mobile}
      <div className="md:flex">
        <aside className={`hidden md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:flex-col ${dark ? "w-58 bg-inverse text-on-inverse" : "w-52 border-r border-rule bg-page text-ink"}`}>
          <div className="px-5 py-5"><BrandBlock brand={brand} tone={dark ? "inverse" : "page"} /></div>
          <nav className="flex flex-col gap-1 px-3" aria-label="Main">
            {items.map((it) => {
              const on = isActive(path, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-3 text-sm transition ${
                    on ? (dark ? "bg-page font-semibold text-ink" : "bg-surface-alt font-semibold text-ink") : dark ? "text-on-inverse hover:bg-on-inverse/10" : "text-ink-2 hover:bg-surface"
                  }`}
                >
                  {!dark && <span className={on ? "text-accent" : "text-muted"}><Icon name={it.icon} /></span>}
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? (
                    dark ? <span className="font-display text-lg font-medium">{it.badge}</span> : <span className="rounded-sm bg-accent px-1.5 font-mono text-xs text-on-accent">{it.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className={`mt-auto border-t px-5 py-4 ${dark ? "border-inverse-rule" : "border-rule"}`}>
            <div className={`type-body-small truncate ${dark ? "text-on-inverse-muted" : "text-muted"}`}>{userLabel}</div>
            {signOutForm(`mt-1 text-sm ${dark ? "text-on-inverse" : "text-ink-2 hover:text-ink"}`)}
          </div>
        </aside>
        <main className="min-w-0 flex-1 animate-rise px-[var(--space-page)] py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </>
  );
}
