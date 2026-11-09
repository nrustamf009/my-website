import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listingSnapshotNumbers } from "@/lib/dscr";
import { rate, ratio, relativeTime, usd } from "@/lib/format";
import { deleteSnapshot } from "@/lib/actions/snapshots";
import { Button, Card, CardHeader, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";

export default async function SnapshotDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { broker } = await requireBroker();
  const { id } = await params;
  const { created } = await searchParams;
  const s = await prisma.snapshot.findFirst({
    where: { id, brokerId: broker.id },
    include: { realtor: true, leads: { orderBy: { createdAt: "desc" } }, scans: { orderBy: { createdAt: "desc" } } },
  });
  if (!s) notFound();
  const url = `${env.appUrl}/b/${broker.slug}/l/${s.token}`;
  const qr = await QRCode.toDataURL(`${url}?src=qr`, { margin: 1, width: 280 });
  const n = listingSnapshotNumbers({ price: s.price, monthlyRent: s.monthlyRent, ratePct: s.ratePct, escrow: s });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={s.address}
        subtitle={`With ${s.realtor.name} (${s.realtor.brokerage}) · ${usd(s.price)} · rent ${usd(s.monthlyRent)}/mo (${s.rentSource.toLowerCase()}) · ${rate(s.ratePct)}`}
        actions={<><LinkButton href={`/dashboard/snapshots/${s.id}/pdf`} variant="accent" target="_blank">Download PDF</LinkButton><LinkButton href={url} variant="secondary" target="_blank">Property page ↗</LinkButton></>}
      />
      {created && <Notice tone="good">Snapshot created. Download the PDF and send it to {s.realtor.name.split(" ")[0]}.</Notice>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="DSCR @ 20% down" value={ratio(n.twenty.dscr)} hint={`PITIA ${usd(n.twenty.pitia)}`} />
        <Stat label="DSCR @ 25% down" value={ratio(n.twentyFive.dscr)} hint={`PITIA ${usd(n.twentyFive.pitia)}`} />
        <Stat label="QR scans" value={s.scans.length} hint={s.scans[0] ? `last ${relativeTime(s.scans[0].createdAt)}` : "none yet"} />
        <Stat label="Leads" value={s.leads.length} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader title="Leads from this listing" />
          <ul className="divide-y divide-line">
            {s.leads.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No leads yet.</li>}
            {s.leads.map((l) => (
              <li key={l.id} className="flex justify-between px-5 py-3 text-sm">
                <a href={`/dashboard/leads/${l.id}`} className="font-medium hover:text-accent">{l.name}</a>
                <span className="text-muted">{relativeTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code" className="mx-auto w-48" />
          <p className="mt-3 break-all text-xs text-muted">{url}</p>
          <div className="mt-3 flex justify-center"><CopyButton text={url} label="Copy link" /></div>
          <form action={deleteSnapshot.bind(null, s.id)} className="mt-6"><Button variant="danger" size="sm">Delete snapshot</Button></form>
        </Card>
      </div>
    </div>
  );
}
