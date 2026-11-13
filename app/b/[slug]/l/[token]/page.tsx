import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicContext } from "@/lib/broker";
import { forBroker, prisma } from "@/lib/db";
import { listingSnapshot, type PropertyType, type UsState } from "@/lib/dscr";
import { listingInputOf } from "@/lib/snapshots-pdf";
import { turnstileSiteKey } from "@/lib/providers/bot";
import { withPreview } from "@/lib/preview";
import { dscr, pct, rate, usd, usdSigned } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { PublicShell, UnavailablePage } from "@/components/public/PublicShell";
import { InstantCheck } from "@/components/public/InstantCheck";
import { ScanBeacon } from "@/components/public/ScanBeacon";
import { BrokerMark, SectionTitle } from "@design/components/primitives";
import { VerdictBadge } from "@design/variants/VerdictBadge";
import { cx } from "@/components/ui";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string; token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(slug: string, token: string) {
  const broker = await prisma.broker.findUnique({ where: { slug }, select: { id: true } });
  if (!broker) return null;
  const snap = await forBroker(broker.id).snapshot.findFirst({ where: { token }, include: { realtor: true } });
  if (!snap) return null;
  const pc = await getPublicContext(slug, { loId: snap.ownerUserId, feature: "snapshot" });
  return pc ? { pc, snap } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, token } = await params;
  const r = await load(slug, token);
  if (!r || r.pc.unavailable) return { title: "Listing" };
  return { title: { absolute: `${r.snap.address} · Investor numbers` }, description: `DSCR financing snapshot for ${r.snap.address}: payment, DSCR and cash flow at 20% and 25% down.`, robots: { index: false } };
}


export default async function ListingPage({ params, searchParams }: Props) {
  const { slug, token } = await params;
  const r = await load(slug, token);
  if (!r) notFound();
  const { pc, snap } = r;
  if (pc.unavailable) return <UnavailablePage />;
  const brand = await withPreview(pc.brand, pc.broker, await searchParams);
  const cols = listingSnapshot(listingInputOf(snap), pc.ctx);
  const first = pc.brand.lo.name.split(" ")[0]!;
  const realtor = snap.realtor;
  return (
    <PublicShell brand={brand} surface="Investor snapshot">
      <ScanBeacon slug={slug} token={token} />
      <section className="mx-auto max-w-6xl px-[var(--space-page)] pt-6 sm:px-6 sm:pt-10">
        <div className="overflow-hidden rounded-2xl border border-rule bg-surface">
          {snap.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={snap.photoUrl} alt={`Photo of ${snap.address}`} className="h-56 w-full object-cover sm:h-80" />
          )}
          <div className="p-5 sm:p-7">
            <p className="type-eyebrow text-accent">{t.listing.eyebrow}</p>
            <h1 className="type-h1 mt-2 text-ink" style={{ textWrap: "balance" }} data-testid="listing-address">{snap.address}</h1>
            <p className="mt-1 text-sm text-muted">
              List price <span className="num font-medium text-ink">{usd(snap.listPriceCents)}</span> · {snap.rentSource === "PROVIDER" ? "Market rent estimate" : "Expected rent"} <span className="num font-medium text-ink">{usd(snap.rentCents)}/mo</span> · Rate <span className="num">{rate(snap.rateMilli)}</span>
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="listing-columns">
              {cols.map((c) => (
                <div key={c.downRatio} className="rounded-xl border border-rule bg-surface-alt p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="type-eyebrow text-muted">{pct(c.downRatio)} down · {usd(c.downPaymentCents)}</span>
                    <VerdictBadge verdict={c.verdict} size="sm" testId={`listing-verdict-${c.downRatio}`} />
                  </div>
                  <div className="mt-2 flex items-end gap-4">
                    <div>
                      <div className="type-eyebrow text-muted">DSCR</div>
                      <div className="type-metric num text-ink">{dscr(c.dscrRatio)}</div>
                    </div>
                    <div className="text-sm">
                      <div className="num"><b>{usd(c.pitiaCents)}</b>/mo payment</div>
                      <div className={cx("num", c.cashFlowCents >= 0 ? "text-accent" : "text-negative")}>{usdSigned(c.cashFlowCents)}/mo cash flow</div>
                    </div>
                  </div>
                  <dl className="type-body-small mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-muted">
                    <dt>Cash to close (est.)</dt><dd className="num text-right text-ink">{usd(c.cashToCloseCents)}</dd>
                    <dt>Rent for DSCR 1.00</dt><dd className="num text-right text-ink">{usd(c.rentForDscr100Cents)}</dd>
                    <dt>Rent for DSCR 1.20</dt><dd className="num text-right text-ink">{usd(c.rentForDscr120Cents)}</dd>
                  </dl>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-rule pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {realtor.headshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={realtor.headshotUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <BrokerMark logoUrl={realtor.logoUrl} name={realtor.name} size={40} />
                )}
                <div>
                  <div className="font-medium text-ink" data-testid="listing-realtor">{t.listing.shared(realtor.name, realtor.brokerage)}</div>
                  <div className="text-xs text-muted">{[realtor.phone, realtor.email].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
              <p className="type-fine max-w-md text-muted" data-testid="respa-note">{t.listing.respa(pc.broker.companyName, realtor.brokerage)}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-[var(--space-page)] pb-4 pt-8 sm:px-6">
        <SectionTitle>Adjust the assumptions</SectionTitle>
        <p className="mt-1 text-sm text-muted">Change the down payment, rent, credit score or loan type. Numbers update instantly; {first} can confirm them with you.</p>
      </section>
      <section className="mx-auto max-w-6xl px-[var(--space-page)] sm:px-6">
        <InstantCheck
          slug={slug}
          loSlug={pc.brand.lo.slug}
          ctx={pc.ctx}
          companyName={pc.broker.companyName}
          loFirstName={first}
          loPhone={pc.brand.lo.phone}
          privacyPolicyUrl={pc.brand.privacyPolicyUrl}
          turnstileSiteKey={turnstileSiteKey()}
          listing={{ token: snap.token, address: snap.address }}
          initial={{
            mode: "PURCHASE",
            address: snap.address,
            state: snap.state as UsState,
            propertyType: snap.propertyType as PropertyType,
            priceCents: snap.listPriceCents,
            rentCents: snap.rentCents,
            taxesAnnualCents: snap.taxesAnnualCents,
            insuranceAnnualCents: snap.insuranceAnnualCents,
            hoaMonthlyCents: snap.hoaMonthlyCents,
            downPaymentRatio: 2_500,
          }}
        />
      </section>
    </PublicShell>
  );
}
