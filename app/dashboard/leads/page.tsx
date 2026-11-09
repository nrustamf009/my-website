import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/broker";
import { VERDICT_LABEL, type Verdict } from "@/lib/dscr";
import { ratio, relativeTime, usd } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Td, Th, cx } from "@/components/ui";

export const metadata = { title: "Leads" };

const SOURCES = [
  ["", "All"],
  ["CHECK", "Instant Check"],
  ["LISTING", "Listing QR"],
] as const;

const VERDICT_TONE = { LIKELY: "good", BORDERLINE: "warn", UNLIKELY: "bad" } as const;

export default async function Leads({ searchParams }: { searchParams: Promise<{ source?: string; status?: string }> }) {
  const { broker } = await requireBroker();
  const { source, status } = await searchParams;
  const leads = await prisma.lead.findMany({
    where: { brokerId: broker.id, ...(source ? { source } : {}), status: status === "ARCHIVED" ? "ARCHIVED" : { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    include: { realtor: true },
    take: 300,
  });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Leads" subtitle="Investors who requested an analysis or a pre-qualification. Every lead agreed to be contacted." />
      <div className="mb-4 flex flex-wrap gap-2">
        {SOURCES.map(([v, l]) => (
          <Link key={v} href={v ? `/dashboard/leads?source=${v}` : "/dashboard/leads"} className={cx("rounded-full border px-3 py-1 text-sm", (source ?? "") === v && status !== "ARCHIVED" ? "border-accent bg-accent-soft text-accent-deep" : "border-line bg-white text-ink-2")}>{l}</Link>
        ))}
        <Link href="/dashboard/leads?status=ARCHIVED" className={cx("rounded-full border px-3 py-1 text-sm", status === "ARCHIVED" ? "border-accent bg-accent-soft text-accent-deep" : "border-line bg-white text-ink-2")}>Archived</Link>
      </div>
      {leads.length === 0 ? (
        <EmptyState title="No leads here" body="Share your Instant Check page or a listing snapshot to start collecting leads." />
      ) : (
        <>
        <div className="space-y-2 sm:hidden">
          {leads.map((l) => {
            const r = parseJson<{ dscr: number | null; verdict: Verdict } | null>(l.resultJson, null);
            return (
              <Link key={l.id} href={`/dashboard/leads/${l.id}`} className="block rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{l.name}</div>
                    <div className="truncate text-xs text-muted">{l.propertyAddress ?? "—"}</div>
                  </div>
                  {l.status === "NEW" ? <Badge tone="accent">New</Badge> : <Badge>{l.status.toLowerCase()}</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {r && <Badge tone={VERDICT_TONE[r.verdict]}>{ratio(r.dscr)} · {VERDICT_LABEL[r.verdict]}</Badge>}
                  <span>{l.source === "LISTING" ? `Listing · ${l.realtor?.name ?? "realtor"}` : "Instant Check"}</span>
                  <span>· {relativeTime(l.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <Card className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[820px]">
            <thead className="bg-paper"><tr><Th>Investor</Th><Th>Property</Th><Th className="text-right">DSCR</Th><Th>Source</Th><Th>Status</Th><Th className="text-right">When</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {leads.map((l) => {
                const r = parseJson<{ dscr: number | null; verdict: Verdict } | null>(l.resultJson, null);
                return (
                  <tr key={l.id} className="hover:bg-paper/60">
                    <Td><Link href={`/dashboard/leads/${l.id}`} className="font-medium text-ink hover:text-accent">{l.name}</Link><div className="text-xs text-muted">{l.email}</div></Td>
                    <Td className="max-w-64"><div className="truncate">{l.propertyAddress ?? "—"}</div><div className="text-xs text-muted">{l.purchasePrice ? usd(l.purchasePrice) : ""}{l.monthlyRent ? ` · rent ${usd(l.monthlyRent)}` : ""}</div></Td>
                    <Td className="text-right">{r ? <Badge tone={VERDICT_TONE[r.verdict]}>{ratio(r.dscr)} · {VERDICT_LABEL[r.verdict]}</Badge> : "—"}</Td>
                    <Td>{l.source === "LISTING" ? <Badge tone="accent">Listing · {l.realtor?.name ?? "realtor"}</Badge> : <Badge>Instant Check</Badge>}</Td>
                    <Td>{l.status === "NEW" ? <Badge tone="accent">New</Badge> : <Badge>{l.status.toLowerCase()}</Badge>}</Td>
                    <Td className="text-right text-muted">{relativeTime(l.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </div>
  );
}
