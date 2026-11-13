import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { EmbedPanel } from "@/components/settings/EmbedPanel";
import { env } from "@/lib/env";
import { CopyButton } from "@/components/dashboard/CopyButton";

export const metadata = { title: "Share & embed" };

export default async function Share() {
  const { broker, user } = await requireBroker();
  const team = await prisma.user.findMany({ where: { brokerId: broker.id, active: true, slug: { not: null } }, orderBy: { name: "asc" } });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Share & embed" subtitle="Leads from these links land in your dashboard, tagged with source and UTM." />
      <EmbedPanel slug={broker.slug} loSlug={user?.slug} />
      {team.length > 1 && (
        <Card>
          <CardHeader title="Team links" subtitle="Each loan officer's link shows their name and NMLS, and leads are assigned to them." />
          <ul className="divide-y divide-line">
            {team.map((u) => {
              const url = `${env.appUrl}/b/${broker.slug}/check?lo=${u.slug}`;
              return <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span className="min-w-0"><span className="block font-medium">{u.name}</span><span className="block truncate text-xs text-muted">{url}</span></span><CopyButton text={url} /></li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
