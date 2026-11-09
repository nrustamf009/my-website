import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { relativeTime } from "@/lib/format";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Calls" };

export default async function Calls() {
  const { broker } = await requireBroker();
  const calls = await prisma.callSession.findMany({ where: { brokerId: broker.id }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, inputType: true, createdAt: true, scenarioId: true } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Call-to-Scenario" subtitle="Upload a call or paste notes. Get the deal, the objections and a ready-to-send follow-up." actions={<LinkButton href="/dashboard/calls/new" variant="accent">New call</LinkButton>} />
      {calls.length === 0 ? (
        <EmptyState title="No calls yet" body="Try it with one of the sample transcripts." action={<LinkButton href="/dashboard/calls/new">New call</LinkButton>} />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {calls.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/calls/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-paper/60">
                  <div><div className="font-medium">{c.title ?? "Untitled call"}</div><div className="text-xs text-muted">{c.inputType === "AUDIO" ? "Recording" : "Notes"} · {relativeTime(c.createdAt)}</div></div>
                  {c.status === "CONVERTED" ? <Badge tone="good">Scenario created</Badge> : <Badge tone="warn">Needs review</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
