import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveBrokerBySlug } from "@/lib/broker";
import { pickPublic } from "@/lib/leads";
import { currentDevice } from "@/lib/request";
import { getVerdict, listingSnapshotNumbers, VERDICT_LABEL } from "@/lib/dscr";
import { pct, rate, ratio, usd } from "@/lib/format";
import { PublicShell } from "@/components/public/PublicShell";
import { ListingPrequal } from "@/components/public/ListingPrequal";
import { Card, cx } from "@/components/ui";
import { initials } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false }, title: { absolute: "Investor Financing Snapshot" } };

export default async function ListingPage({ params, searchParams }: { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ src?: string }> }) {
  const { slug, token } = await params;
  const { src } = await searchParams;
  const broker = await getActiveBrokerBySlug(slug);
  if (!broker) notFound();
  const snap = await prisma.snapshot.findFirst({ where: { token, brokerId: broker.id }, include: { realtor: true } });
  if (!snap) notFound();
  if (src === "qr") await prisma.snapshotScan.create({ data: { snapshotId: snap.id, device: await currentDevice() } });

  const n = listingSnapshotNumbers({ price: snap.price, monthlyRent: snap.monthlyRent, ratePct: snap.ratePct, escrow: snap });
  const cols = [
    { label: "20% down", d: n.twenty },
    { label: "25% down", d: n.twentyFive },
  ];
  const first = broker.name.split(" ")[0]!;

  return (
    <PublicShell broker={pickPublic(broker)}>
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 text-sm sm:px-6">
          {snap.realtor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={snap.realtor.logoUrl} alt="" className="h-8 w-8 rounded-md object-contain" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-xs font-semibold text-white">{initials(snap.realtor.brokerage)}</span>
          )}
          <span className="text-ink-2">Listing shared by <strong className="text-ink">{snap.realtor.name}</strong>, {snap.realtor.brokerage}</span>
        </div>
      </div>
      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Investor Financing Snapshot</p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink sm:text-5xl">{snap.address}</h1>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          <span>List price <strong className="num text-ink">{usd(snap.price)}</strong></span>
          <span>Est. rent <strong className="num text-ink">{usd(snap.monthlyRent)}/mo</strong></span>
          <span>Rate used <strong className="num text-ink">{rate(snap.ratePct)}</strong> · 30-yr</span>
        </div>
      </section>

      <section className="mx-auto mt-8 grid max-w-5xl gap-4 px-4 sm:grid-cols-2 sm:px-6">
        {cols.map(({ label, d }) => {
          const verdict = getVerdict({ dscr: d.dscr, minDscr: broker.minDscr, borderlineBand: broker.borderlineBand, ltv: 1 - d.downPaymentPct, maxLtv: broker.maxLtv });
          return (
          <Card key={label} className="p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-accent">{label}</div>
                <div className="num mt-1 font-display text-5xl text-ink">{ratio(d.dscr)}</div>
                <div className="text-xs text-muted">Estimated DSCR</div>
                <span className={cx("mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", verdict === "LIKELY" ? "bg-good-soft text-good" : verdict === "BORDERLINE" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad")}>{VERDICT_LABEL[verdict]}</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">Monthly payment</div>
                <div className="num text-2xl font-semibold">{usd(d.pitia)}</div>
                <div className={cx("num mt-1 text-sm font-medium", d.monthlyCashFlow >= 0 ? "text-good" : "text-bad")}>{d.monthlyCashFlow >= 0 ? "+" : ""}{usd(d.monthlyCashFlow)}/mo cash flow</div>
              </div>
            </div>
            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Down payment</dt><dd className="num">{usd(d.downPayment)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Loan amount ({pct(1 - d.downPaymentPct)} LTV)</dt><dd className="num">{usd(d.loanAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Rent for DSCR 1.00</dt><dd className="num">{usd(d.rentForDscr1)}/mo</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Rent for DSCR 1.20</dt><dd className="num">{usd(d.rentForDscr12)}/mo</dd></div>
            </dl>
          </Card>
          );
        })}
        <p className="text-xs text-muted sm:col-span-2">Payment includes estimated taxes {usd(snap.taxesMonthly)}/mo and insurance {usd(snap.insuranceMonthly)}/mo{snap.hoaMonthly ? ` and HOA ${usd(snap.hoaMonthly)}/mo` : ""}. Estimates only, not an offer to lend.</p>
      </section>

      <section className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
        <Card className="p-5 sm:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
            <div>
              <h2 className="font-display text-2xl text-ink sm:text-3xl">Get pre-qualified for this property</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">DSCR loans qualify on the property's rent, not your personal income. {first} will confirm the numbers, check pricing across DSCR lenders and send you a pre-qualification you can use with your offer.</p>
              <ul className="mt-4 space-y-2 text-sm text-ink-2">
                {["No tax returns or W-2s", "Close in an LLC", "No SSN needed to start"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-xs text-accent-deep">✓</span>{t}</li>
                ))}
              </ul>
            </div>
            <ListingPrequal slug={broker.slug} token={snap.token} address={snap.address} price={snap.price} monthlyRent={snap.monthlyRent} ratePct={snap.ratePct} hoaMonthly={snap.hoaMonthly} brokerFirstName={first} brokerPhone={broker.phone} />
          </div>
        </Card>
      </section>
    </PublicShell>
  );
}
