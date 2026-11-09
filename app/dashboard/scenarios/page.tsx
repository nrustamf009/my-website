import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { duration, relativeTime, usd } from "@/lib/format";
import { PURPOSE_LABEL } from "@/lib/scenarios";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Td, Th } from "@/components/ui";

export const metadata = { title: "Scenarios" };

export default async function Scenarios() {
  const { broker } = await requireBroker();
  const list = await prisma.scenario.findMany({
    where: { brokerId: broker.id, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: { views: { orderBy: { startedAt: "desc" } }, options: true },
  });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Scenarios" subtitle="Side-by-side loan options for investors. You'll get an email when they open it." actions={<LinkButton href="/dashboard/scenarios/new" variant="accent">New scenario</LinkButton>} />
      {list.length === 0 ? (
        <EmptyState title="No scenarios yet" body="Build one from scratch, from a lead, or from a call recording." action={<LinkButton href="/dashboard/scenarios/new">New scenario</LinkButton>} />
      ) : (
        <>
        <div className="space-y-2 sm:hidden">
          {list.map((s) => {
            const interested = s.options.find((o) => o.id === s.interestedOptionId);
            return (
              <Link key={s.id} href={`/dashboard/scenarios/${s.id}`} className="block rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{s.investorName}</div>
                    <div className="truncate text-xs text-muted">{s.propertyAddress}</div>
                  </div>
                  {interested ? <Badge tone="good">Picked {interested.label}</Badge> : s.status === "DRAFT" ? <Badge>Draft</Badge> : <Badge tone="accent">Shared</Badge>}
                </div>
                <div className="mt-2 text-xs text-muted">{s.views.length} open{s.views.length === 1 ? "" : "s"} · {s.views[0] ? `last ${relativeTime(s.views[0].startedAt)}` : "not opened yet"}</div>
              </Link>
            );
          })}
        </div>
        <Card className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[820px]">
            <thead className="bg-paper"><tr><Th>Investor</Th><Th>Property</Th><Th>Status</Th><Th className="text-right">Opens</Th><Th className="text-right">Time on page</Th><Th>Last opened</Th><Th>Interest</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {list.map((s) => {
                const time = s.views.reduce((a, v) => a + v.activeSeconds, 0);
                const interested = s.options.find((o) => o.id === s.interestedOptionId);
                return (
                  <tr key={s.id} className="hover:bg-paper/60">
                    <Td><Link href={`/dashboard/scenarios/${s.id}`} className="font-medium text-ink hover:text-accent">{s.investorName}</Link><div className="text-xs text-muted">{PURPOSE_LABEL[s.loanPurpose]}{s.origin === "CALL" ? " · from call" : ""}</div></Td>
                    <Td className="max-w-60"><div className="truncate">{s.propertyAddress}</div><div className="text-xs text-muted">{usd(s.propertyValue)}</div></Td>
                    <Td>{s.status === "DRAFT" ? <Badge>Draft</Badge> : <Badge tone="accent">Shared</Badge>}</Td>
                    <Td className="num text-right">{s.views.length}</Td>
                    <Td className="num text-right">{time ? duration(time) : "—"}</Td>
                    <Td className="text-muted">{s.views[0] ? relativeTime(s.views[0].startedAt) : "Not yet"}</Td>
                    <Td>{interested ? <Badge tone="good">Option {interested.label}</Badge> : <span className="text-muted">—</span>}</Td>
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
