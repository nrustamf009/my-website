import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features } from "@/lib/broker";
import { realtorStats, scansBySnapshot } from "@/lib/snapshots";
import { relativeTime, shortDate, usd } from "@/lib/format";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Td, Th } from "@/components/ui";
import { EmailStatsButton, RealtorForm } from "@/components/snapshots/Forms";

export const metadata = { title: "Listing Snapshots" };

export default async function SnapshotsPage() {
  const { broker, db } = await requireBroker();
  if (!features(broker).snapshot) redirect("/dashboard");
  const [snaps, realtors, stats] = await Promise.all([
    db.snapshot.findMany({ orderBy: { createdAt: "desc" }, include: { realtor: true, _count: { select: { leads: true } } } }),
    db.realtor.findMany({ orderBy: { name: "asc" } }),
    realtorStats(db),
  ]);
  const scans = await scansBySnapshot(db, snaps.map((s) => s.id));
  const byRealtor = new Map(stats.map((s) => [s.realtorId, s]));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Listing Snapshots"
        subtitle="A co-branded one-page flyer for a realtor's listing: payment, DSCR and cash flow at 20% and 25% down, with a QR code to live numbers and a financing request form."
        actions={<LinkButton href="/dashboard/snapshots/new" variant="accent">New snapshot</LinkButton>}
      />
      {snaps.length === 0 ? (
        <EmptyState title="Make your first snapshot" body="Pick a listing from a realtor you work with. Investors scan the QR on the flyer, see the numbers, and request financing from you." action={<LinkButton href="/dashboard/snapshots/new" variant="accent">New snapshot</LinkButton>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-160" data-testid="snapshot-table">
              <thead className="border-b border-line"><tr><Th>Listing</Th><Th>Realtor</Th><Th className="text-right">Scans</Th><Th className="text-right">Leads</Th><Th>Created</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {snaps.map((s) => (
                  <tr key={s.id} className="hover:bg-paper/60">
                    <Td><Link href={`/dashboard/snapshots/${s.id}`} className="font-medium text-ink hover:text-accent">{s.address}</Link><div className="text-xs text-muted">{usd(s.listPriceCents)} · rent {usd(s.rentCents)}/mo</div></Td>
                    <Td>{s.realtor.name}<div className="text-xs text-muted">{s.realtor.brokerage}</div></Td>
                    <Td className="num text-right">{scans.get(s.id)?.count ?? 0}</Td>
                    <Td className="num text-right">{s._count.leads}</Td>
                    <Td className="text-muted">{shortDate(s.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <h2 className="mb-3 mt-10 font-display text-2xl">Realtor partners</h2>
      <div className="grid gap-4 lg:grid-cols-2" data-testid="realtor-stats">
        {realtors.map((r) => {
          const st = byRealtor.get(r.id);
          return (
            <Card key={r.id}>
              <CardHeader title={r.name} subtitle={`${r.brokerage}${r.email ? ` · ${r.email}` : ""}`} action={<EmailStatsButton realtorId={r.id} disabled={!r.email} />} />
              <div className="grid grid-cols-4 gap-2 px-5 pb-4 text-center">
                {[["Snapshots", st?.snapshots ?? 0], ["Scans", st?.scans ?? 0], ["Scans 30d", st?.scans30 ?? 0], ["Leads", st?.leads ?? 0]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-paper/70 py-2"><div className="num font-display text-2xl">{v}</div><div className="text-xs text-muted">{l}</div></div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
                <span>Last activity {st?.lastActivity ? relativeTime(st.lastActivity) : "—"}</span>
                <details className="text-right"><summary className="cursor-pointer text-accent">Edit</summary><div className="mt-3 text-left"><RealtorForm initial={r} /></div></details>
              </div>
            </Card>
          );
        })}
        <Card>
          <CardHeader title="Add a realtor" subtitle="Headshot and logo appear on the flyer next to yours." />
          <div className="px-5 pb-5"><RealtorForm /></div>
        </Card>
      </div>
    </div>
  );
}
