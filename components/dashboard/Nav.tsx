"use client";

import Link from "next/link";
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

export function Icon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:overflow-visible md:pb-0">
      {items.map((it) => {
        const active = it.href === path || (it.href !== "/dashboard" && it.href !== "/admin" && path.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-black/5",
            )}
          >
            <span className={active ? "text-accent" : "text-muted"}><Icon name={it.icon} /></span>
            <span className="font-medium">{it.label}</span>
            {it.badge ? <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent">{it.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
