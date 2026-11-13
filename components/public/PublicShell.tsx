import type { ReactNode } from "react";
import type { PublicBrand } from "@/lib/broker";
import { ThemeScope } from "@design/ThemeScope";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { BrokerFooter } from "./BrokerFooter";

/** Branded chrome for every investor-facing page. */
export function PublicShell({ brand, children, compact = false }: { brand: PublicBrand; children: ReactNode; compact?: boolean }) {
  const tel = brand.lo.phone?.replace(/[^\d+]/g, "");
  return (
    <ThemeScope theme={brand.theme} accent={brand.accentColor} paintRoot className="flex flex-col">
      {brand.isDemo && !compact && <div className="bg-ink px-4 py-1.5 text-center text-xs text-page">Demo data · fictional broker for illustration</div>}
      {!compact && (
        <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <BrokerAvatar broker={{ logoUrl: brand.logoUrl, companyName: brand.companyName, accentColor: brand.accentColor }} size={38} />
              <div className="min-w-0">
                <div className="truncate font-semibold leading-tight text-ink">{brand.companyName}</div>
                <div className="truncate text-xs text-muted">
                  {brand.lo.name}
                  {brand.lo.nmlsId ? ` · NMLS #${brand.lo.nmlsId}` : ` · NMLS #${brand.companyNmlsId}`}
                </div>
              </div>
            </div>
            {tel ? (
              <a href={`tel:${tel}`} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-sm hover:brightness-110">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" /></svg>
                <span className="hidden sm:inline">{brand.lo.phone}</span>
                <span className="sm:hidden">Call</span>
              </a>
            ) : (
              <a href={`mailto:${brand.lo.email}`} className="text-sm font-medium text-accent">{brand.lo.email}</a>
            )}
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
      <BrokerFooter brand={brand} compact={compact} />
    </ThemeScope>
  );
}

export function UnavailablePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 text-center">
      <div>
        <h1 className="font-display text-3xl text-ink">This page is unavailable</h1>
        <p className="mt-2 text-sm text-muted">Please contact your loan officer directly.</p>
      </div>
    </main>
  );
}
