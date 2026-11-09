import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { ImpersonateButton } from "../ImpersonateButton";

export const metadata = { title: "Brokers" };

export default async function BrokersPage() {
  const { agency } = await requireAdmin();
  const brokers = await prisma.broker.findMany({ where: { agencyId: agency.id }, orderBy: { companyName: "asc" }, include: { _count: { select: { users: true } } } });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Brokers" subtitle="Each broker is a separate tenant with their own branding, leads and public pages." actions={<LinkButton href="/admin/brokers/new">Add broker</LinkButton>} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {brokers.map((b) => (
          <Card key={b.id} className="flex flex-col p-5">
            <div className="h-1.5 -mx-5 -mt-5 mb-5 rounded-t-2xl" style={{ background: b.accentColor }} />
            <Link href={`/admin/brokers/${b.id}`} className="flex items-center gap-3">
              <BrokerAvatar broker={b} size={44} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{b.companyName}</div>
                <div className="truncate text-sm text-muted">{b.name} · NMLS #{b.nmlsId}</div>
              </div>
            </Link>
            <div className="mt-4 space-y-1 text-xs text-muted">
              <div className="truncate">{env.appUrl}/b/{b.slug}</div>
              <div>{b._count.users} login{b._count.users === 1 ? "" : "s"} {!b.active && <Badge tone="bad">Inactive</Badge>}</div>
            </div>
            <div className="mt-5 flex gap-2">
              <LinkButton href={`/admin/brokers/${b.id}`} variant="ghost" size="sm">Edit</LinkButton>
              <LinkButton href={`/b/${b.slug}/check`} variant="ghost" size="sm" target="_blank">Public page ↗</LinkButton>
              <div className="ml-auto"><ImpersonateButton brokerId={b.id} /></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
