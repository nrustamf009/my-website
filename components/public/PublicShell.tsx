import type { ReactNode } from "react";
import type { PublicBroker } from "@/lib/broker";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";

/** Branded chrome for every investor-facing page: header + compliance footer. */
export function PublicShell({ broker, children, compact = false }: { broker: PublicBroker; children: ReactNode; compact?: boolean }) {
  const tel = broker.phone?.replace(/[^\d+]/g, "");
  return (
    <div className="flex min-h-screen flex-col" style={{ "--accent": broker.accentColor } as React.CSSProperties}>
      {!compact && (
        <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <BrokerAvatar broker={broker} size={38} />
              <div className="min-w-0">
                <div className="truncate font-semibold leading-tight text-ink">{broker.companyName}</div>
                <div className="truncate text-xs text-muted">{broker.name} · NMLS #{broker.nmlsId}</div>
              </div>
            </div>
            {tel ? (
              <a href={`tel:${tel}`} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-sm hover:brightness-110">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" /></svg>
                <span className="hidden sm:inline">{broker.phone}</span>
                <span className="sm:hidden">Call</span>
              </a>
            ) : (
              <a href={`mailto:${broker.email}`} className="text-sm font-medium text-accent">{broker.email}</a>
            )}
          </div>
        </header>
      )}
      <div className="flex-1">{children}</div>
      <ComplianceFooter broker={broker} compact={compact} />
    </div>
  );
}

export function ComplianceFooter({ broker, compact }: { broker: PublicBroker; compact?: boolean }) {
  return (
    <footer className={compact ? "px-4 py-4" : "mt-12 border-t border-line bg-white"}>
      <div className={compact ? "" : "mx-auto max-w-6xl px-4 py-8 sm:px-6"}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="font-semibold">{broker.name}</span>
          <span>{broker.title}</span>
          <span>NMLS #{broker.nmlsId}</span>
          <span>{broker.companyName}{broker.companyNmlsId ? ` · NMLS #${broker.companyNmlsId}` : ""}</span>
          {broker.licensedStates && <span>Licensed in {broker.licensedStates}</span>}
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M12 2 1 10h3v11h16V10h3L12 2zm-5 10h10v2H7v-2zm0 4h10v2H7v-2z" /></svg>
            Equal Housing Opportunity
          </span>
        </div>
        <p className="mt-2 max-w-4xl text-[11px] leading-relaxed text-muted">{broker.disclaimerText}</p>
        {!compact && (
          <p className="mt-2 text-[11px] text-muted">
            <a href={`https://www.nmlsconsumeraccess.org/EntityDetails.aspx/INDIVIDUAL/${broker.nmlsId}`} target="_blank" rel="noopener noreferrer" className="underline">NMLS Consumer Access</a>
          </p>
        )}
      </div>
    </footer>
  );
}
