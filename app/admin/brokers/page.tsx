import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { features, FEATURE_LABELS, type FeatureKey } from "@/lib/broker";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { ImpersonateButton } from "../ImpersonateButton";

export const metadata = { title: "Brokers" };

export default async function BrokersPage() {
  const { agency } = await requireAdmin();
  const brokers = await prisma.broker.findMany({ where: { agencyId: agency.id }, orderBy: { companyName: "asc" }, include: { _count: { select: { users: true } } } });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Brokers" subtitle="Each broker is a separate tenant with its own branding, team, data and public pages." actions={<LinkButton href="/admin/brokers/new">Add broker</LinkButton>} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {brokers.map((b) => {
          const f = features(b);
          return (
            <Card key={b.id} className="flex flex-col overflow-hidden">
              <div className="h-1.5" style={{ background: b.accentColor }} />
              <div className="flex flex-1 flex-col p-5">
                <Link href={`/admin/brokers/${b.id}`} className="flex items-center gap-3">
                  <BrokerAvatar broker={b} size={44} />
                  <div className="min-w-0"><div className="truncate font-semibold">{b.companyName}</div><div className="truncate text-sm text-muted">NMLS #{b.companyNmlsId} · {b._count.users} user{b._count.users === 1 ? "" : "s"}</div></div>
                </Link>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Badge tone={b.status === "ACTIVE" ? "good" : b.status === "TRIAL" ? "warn" : "bad"}>{b.status.toLowerCase()}</Badge>
                  {(Object.keys(f) as FeatureKey[]).filter((k) => !f[k]).map((k) => <Badge key={k}>no {FEATURE_LABELS[k]}</Badge>)}
                  {b.onboardingStep < 6 && <Badge tone="accent">onboarding {b.onboardingStep}/6</Badge>}
                </div>
                <div className="mt-3 truncate text-xs text-muted">{env.appUrl.replace(/^https?:\/\//, "")}/b/{b.slug}</div>
                <div className="mt-auto flex gap-2 pt-4">
                  <LinkButton href={`/admin/brokers/${b.id}`} variant="ghost" size="sm">Manage</LinkButton>
                  <LinkButton href={`/b/${b.slug}/check`} variant="ghost" size="sm" target="_blank">Public page ↗</LinkButton>
                  <div className="ml-auto"><ImpersonateButton brokerId={b.id} /></div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
