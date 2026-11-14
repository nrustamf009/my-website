"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
  camera: <><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2.5h5L16 6" /></>,
  money: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9v6M18 9v6" /></>,
  layers: <><path d="M12 3 2.5 8 12 13l9.5-5z" /><path d="M2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5" /></>,
  phone: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" /></>,
};

export function Icon({ name, className = "size-4.5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`icon ${className}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((it) => {
        const active = it.href === path || (it.href !== "/dashboard" && it.href !== "/admin" && path.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-ink/5",
            )}
          >
            <span className={active ? "text-accent" : "text-muted"}><Icon name={it.icon} /></span>
            <span className="font-medium">{it.label}</span>
            {it.badge ? <span className="ml-auto rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">{it.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: compact top bar with a menu button that opens the full navigation. */
export function MobileBar({ items, header, userLabel, signOut }: { items: NavItem[]; header: ReactNode; userLabel: string; signOut?: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const current = items.find((it) => it.href === path || (it.href !== "/dashboard" && it.href !== "/admin" && path.startsWith(it.href)));
  const badge = items.reduce((n, it) => n + (it.badge ?? 0), 0);
  return (
    <div className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">{header}</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Menu"
          className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink"
        >
          {current?.label ?? "Menu"}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          {badge > 0 && !open && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-semibold text-on-accent">{badge}</span>}
        </button>
      </div>
      {open && (
        <div className="animate-rise border-t border-line pb-3 pt-2">
          <SideNav items={items} />
          <div className="mx-3 mt-3 flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2 text-xs text-muted">
            <span className="truncate">{userLabel}</span>
            {signOut && <form action={signOut}><button className="font-medium text-ink">Sign out</button></form>}
          </div>
        </div>
      )}
    </div>
  );
}
