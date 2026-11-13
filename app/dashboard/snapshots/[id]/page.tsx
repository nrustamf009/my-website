import Link from "next/link";
import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, features } from "@/lib/broker";
import { listingSnapshot } from "@/lib/dscr";
import { listingInputOf, snapshotUrl } from "@/lib/snapshots-pdf";
import { scansBySnapshot } from "@/lib/snapshots";
import { dscr, pct, rate, relativeTime, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { Badge, Card, CardHeader, LinkButton, Notice, cx } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { TemplateSwitch } from "@/components/snapshots/Forms";

export const metadata = { title: "Listing snapshot" };

export default async function SnapshotPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { broker, db } = await requireBroker();
  if (!features(broker).snapshot) redirect("/dashboard");
  const { id } = await params;
  const { created } = await searchParams;
  const s = await db.snapshot.findFirst({ where: { id }, include: { realtor: true, leads: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!s) notFound();
  const cols = listingSnapshot(listingInputOf(s), engineContext(broker));
  const url = snapshotUrl(broker, s);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 320 });
  const scans = (await scansBySnapshot(db, [s.id])).get(s.id);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/snapshots" className="text-sm text-muted hover:text-ink">← Listing Snapshots</Link>
      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">{s.address}</h1>
          <p className="mt-1 text-sm text-muted">With {s.realtor.name}, {s.realtor.brokerage} · {usd(s.listPriceCents)} · rent {usd(s.rentCents)}/mo ({s.rentSource === "PROVIDER" ? "estimate" : "provided"}) · {rate(s.rateMilli)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/api/snapshots/${s.id}/pdf`} prefetch={false} target="_blank" variant="accent" data-testid="pdf-link">Download PDF flyer</LinkButton>
          <LinkButton href={url} prefetch={false} target="_blank" variant="secondary">Open investor page</LinkButton>
        </div>
      </div>
      {created && <div className="mb-5"><Notice tone="good">Snapshot ready. Download the PDF and send it to {s.realtor.name.split(" ")[0]}; the QR code opens the live page.</Notice></div>}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="What investors see" subtitle="Same numbers as the flyer and the investor page." />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              {cols.map((c) => (
                <div key={c.downRatio} className="rounded-xl border border-line p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">{pct(c.downRatio)} down</div>
                  <div className="num mt-1 font-display text-3xl">DSCR {dscr(c.dscrRatio)}</div>
                  <Badge tone={c.verdict === "STRONG" ? "good" : c.verdict === "NOT_ELIGIBLE" ? "bad" : "warn"}>{t.verdict[c.verdict]}</Badge>
                  <dl className="mt-3 space-y-1 text-sm">
                    {([["Payment (PITIA)", `${usd(c.pitiaCents)}/mo`], ["Cash flow", `${usd(c.cashFlowCents)}/mo`], ["Cash to close", usd(c.cashToCloseCents)], ["Rent for DSCR 1.00", usd(c.rentForDscr100Cents)], ["Rent for DSCR 1.20", usd(c.rentForDscr120Cents)]] as const).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className={cx("num", k === "Cash flow" && c.cashFlowCents < 0 && "text-bad")}>{v}</dd></div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Flyer style" subtitle="Switch any time; the QR code and link stay the same." />
            <div className="px-5 pb-5"><TemplateSwitch id={s.id} value={s.template === "MODERN" ? "MODERN" : "CLASSIC"} /></div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Share" />
            <div className="flex items-center gap-4 px-5 pb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code to the investor page" className="h-28 w-28 rounded-lg border border-line" />
              <div className="min-w-0 space-y-2">
                <div className="truncate rounded-lg bg-paper px-2 py-1.5 text-xs text-ink-2" data-testid="snapshot-url">{url}</div>
                <CopyButton text={url} label="Copy link" />
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Activity" subtitle={scans?.last ? `Last scan ${relativeTime(scans.last)}` : "No scans yet"} />
            <div className="grid grid-cols-2 gap-2 px-5 pb-4 text-center">
              <div className="rounded-xl bg-paper/70 py-3"><div className="num font-display text-3xl" data-testid="scan-count">{scans?.count ?? 0}</div><div className="text-xs text-muted">Scans and views</div></div>
              <div className="rounded-xl bg-paper/70 py-3"><div className="num font-display text-3xl">{s.leads.length}</div><div className="text-xs text-muted">Financing requests</div></div>
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {s.leads.map((l) => (
                <li key={l.id}><Link href={`/dashboard/leads/${l.id}`} className="flex justify-between px-5 py-2.5 text-sm hover:bg-paper/60"><span className="font-medium">{l.name}</span><span className="text-xs text-muted">{relativeTime(l.createdAt)}</span></Link></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
