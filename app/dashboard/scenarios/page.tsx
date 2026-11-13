import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features } from "@/lib/broker";
import { publicState } from "@/lib/scenarios";
import { relativeTime, shortDate } from "@/lib/format";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Td, Th } from "@/components/ui";

export const metadata = { title: "Scenarios" };

const TONE = { LIVE: "good", DRAFT: "neutral", EXPIRED: "warn", REVOKED: "bad" } as const;

export default async function ScenariosPage() {
  const { broker, db } = await requireBroker();
  if (!features(broker).scenario) redirect("/dashboard");
  const list = await db.scenario.findMany({ orderBy: { updatedAt: "desc" }, include: { options: true, views: { orderBy: { startedAt: "desc" } } }, take: 200 });
  const users = await db.user.findMany({ select: { id: true, name: true } });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Scenarios" subtitle="Side-by-side loan options with a private link. You'll know when the investor opens it, which option they look at, and when they pick one." actions={<LinkButton href="/dashboard/scenarios/new" variant="accent">New scenario</LinkButton>} />
      {list.length === 0 ? (
        <EmptyState title="No scenarios yet" body="Build one from scratch or from an Instant Check lead." action={<LinkButton href="/dashboard/scenarios/new" variant="accent">New scenario</LinkButton>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]" data-testid="scenario-table">
              <thead className="border-b border-line"><tr><Th>Investor · property</Th><Th>Status</Th><Th className="text-right">Opens</Th><Th>Last opened</Th><Th>Picked</Th><Th>LO</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((s) => {
                  const st = publicState(s);
                  const picked = s.options.find((o) => o.id === s.interestedOptionId);
                  return (
                    <tr key={s.id} className="hover:bg-paper/60">
                      <Td><Link href={`/dashboard/scenarios/${s.id}`} className="font-medium text-ink hover:text-accent">{s.investorName}</Link><div className="text-xs text-muted">{s.propertyAddress}</div></Td>
                      <Td><Badge tone={TONE[st]}>{st === "LIVE" ? "Shared" : st[0] + st.slice(1).toLowerCase()}</Badge><div className="mt-0.5 text-[11px] text-muted">{st === "LIVE" ? `until ${shortDate(s.expiresAt)}` : ""}</div></Td>
                      <Td className="num text-right">{s.views.length}</Td>
                      <Td className="text-muted">{s.views[0] ? relativeTime(s.views[0].startedAt) : "—"}</Td>
                      <Td>{picked ? <Badge tone="accent">Option {picked.label}</Badge> : <span className="text-muted">—</span>}</Td>
                      <Td className="text-muted">{users.find((u) => u.id === s.ownerUserId)?.name ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
