import type { PublicBrand } from "@/lib/broker";
import { t } from "@/lib/strings/en";

function EhoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden fill="currentColor">
      <path d="M16 3 2 13h3.5v15h21V13H30L16 3Zm-6.5 13h13v2.6h-13V16Zm0 5h13v2.6h-13V21Z" />
    </svg>
  );
}

/** The ONE compliance footer for every public surface (pages, embeds). PDFs and emails mirror it. */
export function BrokerFooter({ brand, compact = false }: { brand: PublicBrand; compact?: boolean }) {
  return (
    <footer className={compact ? "px-1 py-4" : "mt-14 border-t border-line bg-surface"} data-testid="broker-footer">
      <div className={compact ? "" : "mx-auto max-w-6xl px-4 py-8 sm:px-6"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {brand.lo.headshotUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.lo.headshotUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            )}
            <div className="text-sm text-ink-2">
              <div className="font-semibold text-ink">{brand.lo.name}</div>
              <div className="text-xs">
                {brand.lo.title}
                {brand.lo.nmlsId && <> · NMLS #{brand.lo.nmlsId}</>}
              </div>
              <div className="text-xs">
                {brand.companyName} · Company NMLS #{brand.companyNmlsId}
              </div>
              {brand.licensedStates.length > 0 && <div className="text-xs text-muted">{t.footer.licensedIn(brand.licensedStates.join(", "))}</div>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5"><EhoMark />{t.footer.eho}</span>
            <a className="underline" href={`https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/${brand.companyNmlsId}`} target="_blank" rel="noopener noreferrer">{t.footer.nmlsConsumerAccess}</a>
            {brand.privacyPolicyUrl && <a className="underline" href={brand.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">{t.footer.privacy}</a>}
          </div>
        </div>
        <p className="mt-4 max-w-4xl text-xs leading-relaxed text-muted" data-testid="disclaimer">
          {brand.disclaimer.text} <span className="whitespace-nowrap">({t.footer.disclaimerVersion(brand.disclaimer.version)})</span>
        </p>
      </div>
    </footer>
  );
}
