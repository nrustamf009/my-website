import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Card, CardHeader, LinkButton, Notice, PageHeader } from "@/components/ui";
import { BrokerForm } from "../BrokerForm";
import { ImpersonateButton } from "../../ImpersonateButton";
import { AddUserForm } from "./AddUserForm";

export default async function BrokerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { agency } = await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const broker = await prisma.broker.findFirst({ where: { id, agencyId: agency.id }, include: { users: true } });
  if (!broker) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={broker.companyName}
        subtitle={<>Public pages: <a className="underline" href={`/b/${broker.slug}/check`} target="_blank">{env.appUrl}/b/{broker.slug}</a></>}
        actions={<><LinkButton href={`/b/${broker.slug}/check`} target="_blank" variant="secondary">Open public page</LinkButton><ImpersonateButton brokerId={broker.id} size="md" /></>}
      />
      {created && <Notice tone="good">Broker created. They can sign in at /login with {broker.users[0]?.email}. Impersonate to finish branding, defaults and webhook setup.</Notice>}
      <BrokerForm broker={broker} />
      <Card>
        <CardHeader title="Logins" subtitle="People who can sign in to this broker's dashboard with a magic link" />
        <ul className="divide-y divide-line">
          {broker.users.map((u) => (
            <li key={u.id} className="flex justify-between px-5 py-3 text-sm"><span>{u.name ?? "—"}</span><span className="text-muted">{u.email}</span></li>
          ))}
        </ul>
        <div className="border-t border-line p-5"><AddUserForm brokerId={broker.id} /></div>
      </Card>
    </div>
  );
}
