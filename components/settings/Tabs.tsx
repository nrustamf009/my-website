"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  ["/dashboard/settings", "Branding & licenses"],
  ["/dashboard/settings/team", "Team"],
  ["/dashboard/settings/program", "Program grid"],
  ["/dashboard/settings/states", "Taxes & insurance"],
  ["/dashboard/settings/compliance", "Disclaimers"],
  ["/dashboard/settings/integrations", "Notifications & webhooks"],
] as const;

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Settings sections">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={cx("whitespace-nowrap border-b-2 px-3 py-2 text-sm", path === href ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
