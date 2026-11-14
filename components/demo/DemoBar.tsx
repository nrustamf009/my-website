"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DEMO_BROKERS, DEMO_COOKIE, DEMO_MODULES, demoBroker, demoModuleHref } from "@/lib/auth/demo";

/** Demo navigation on every page: back to the module picker, modules 1–5, and the broker (theme) switch. */
export function DemoBar() {
  const path = usePathname() ?? "/";
  const [cookieSlug, setCookieSlug] = useState<string | null>(null);
  useEffect(() => {
    setCookieSlug(document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE}=([^;]+)`))?.[1] ?? null);
  }, []);

  if (path === "/" || path.startsWith("/embed") || path.startsWith("/dev")) return null;

  const fromPath = path.match(/^\/b\/([^/]+)/)?.[1];
  const slug = demoBroker(fromPath ?? cookieSlug).slug;
  const current = DEMO_MODULES.find((m) => (m.path ? path.startsWith(m.path) : /^\/b\/[^/]+\/check/.test(path)));

  return (
    <nav aria-label="Demo" className="border-b border-inverse-rule bg-inverse text-on-inverse">
      <div className="mx-auto flex max-w-7xl items-center gap-x-4 gap-y-2 overflow-x-auto px-4 py-2 text-sm">
        <a href={`/?b=${slug}`} className="shrink-0 font-medium hover:underline">All modules</a>
        <span aria-hidden className="h-4 w-px shrink-0 bg-inverse-rule" />
        <ul className="flex shrink-0 gap-1">
          {DEMO_MODULES.map((m) => {
            const on = current?.key === m.key;
            return (
              <li key={m.key}>
                <a
                  href={demoModuleHref(m, slug)}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 ${on ? "bg-on-inverse text-inverse" : "text-on-inverse-muted hover:text-on-inverse"}`}
                >
                  <span className="font-mono text-xs">{m.n}</span>
                  <span className="hidden sm:inline">{m.title}</span>
                </a>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {DEMO_BROKERS.map((b) => {
            const on = b.slug === slug;
            const target = current ? demoModuleHref(current, b.slug) : `/go?as=${b.slug}&to=%2Fdashboard`;
            return (
              <a
                key={b.slug}
                href={target}
                aria-current={on ? "true" : undefined}
                title={b.name}
                className={`whitespace-nowrap px-2 py-1 font-mono text-xs ${on ? "border border-on-inverse text-on-inverse" : "border border-transparent text-on-inverse-muted hover:text-on-inverse"}`}
              >
                {b.theme}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
