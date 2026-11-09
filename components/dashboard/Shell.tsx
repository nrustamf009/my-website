import Link from "next/link";
import type { ReactNode } from "react";
import { SideNav, type NavItem } from "./Nav";
import { signOut } from "@/lib/auth/config";
import { ProductMark } from "@/components/brand/Logo";

export function Shell({
  items,
  header,
  banner,
  accent,
  userLabel,
  children,
}: {
  items: NavItem[];
  header: ReactNode;
  banner?: ReactNode;
  accent?: string;
  userLabel: string;
  children: ReactNode;
}) {
  return (
    <div style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined} className="min-h-screen">
      {banner}
      <div className="md:flex">
        <aside className="border-b border-line bg-paper md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
          <div className="flex items-center justify-between px-5 py-4">
            <Link href="/"><ProductMark /></Link>
          </div>
          <div className="px-5 pb-4">{header}</div>
          <SideNav items={items} />
          <div className="mt-auto hidden border-t border-line px-5 py-4 md:block">
            <div className="truncate text-xs text-muted">{userLabel}</div>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="mt-1 text-sm text-ink-2 hover:text-ink">Sign out</button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 animate-rise">{children}</main>
      </div>
    </div>
  );
}
