import type { PublicBrand } from "@/lib/broker";
import { t } from "@/lib/strings/en";
import { EqualHousingMark } from "./primitives";

/**
 * The ONE compliance footer for every public surface (DESIGN.md §2.8): LO + individual NMLS,
 * company + company NMLS, licensed states, versioned disclaimer, NMLS Consumer Access, EHO.
 * PDFs and emails mirror it with PdfBrokerFooter / EmailBrokerFooter from the same data.
 */
export function BrokerFooter({ brand, compact = false }: { brand: PublicBrand; compact?: boolean }) {
  return (
    <footer className={compact ? "py-4" : "mt-16 border-t border-rule bg-surface-alt"} data-testid="broker-footer">
      <div className={compact ? "" : "mx-auto max-w-6xl px-[var(--space-page)] py-8 sm:px-6"}>
        <div className="flex items-start gap-3">
          {brand.lo.headshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.lo.headshotUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          )}
          <div>
            <div className="font-semibold text-ink">{brand.lo.name}</div>
            <div className="type-body-small text-ink-2">
              {brand.lo.title}
              {brand.lo.nmlsId && <> · NMLS #{brand.lo.nmlsId}</>}
            </div>
            <div className="type-body-small text-ink-2">
              {brand.companyName} · Company NMLS #{brand.companyNmlsId}
            </div>
          </div>
        </div>
        <p className="type-fine mt-4 max-w-4xl text-muted" data-testid="disclaimer">
          {brand.disclaimer.text}
          {brand.licensedStates.length > 0 && <> {t.footer.licensedIn(brand.licensedStates.join(", "))}.</>}{" "}
          <a className="underline" href={`https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/${brand.companyNmlsId}`} target="_blank" rel="noopener noreferrer">{t.footer.nmlsConsumerAccess}</a>
          {brand.privacyPolicyUrl && (
            <>
              {" · "}
              <a className="underline" href={brand.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">{t.footer.privacy}</a>
            </>
          )}{" "}
          <span className="whitespace-nowrap">({t.footer.disclaimerVersion(brand.disclaimer.version)})</span>
        </p>
        <div className="mt-4 flex items-center gap-2 text-ink">
          <EqualHousingMark className="icon h-6 w-6" />
          <span className="type-eyebrow text-ink">{t.footer.eho}</span>
        </div>
      </div>
    </footer>
  );
}
