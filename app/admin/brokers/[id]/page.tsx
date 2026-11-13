import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { features, FEATURE_LABELS, licensedStates, type FeatureKey } from "@/lib/broker";
import { setBrokerFeatures, setBrokerStatus, setBrokerTheme } from "@/lib/actions/admin";
import { THEMES, themeIds } from "@design";
import { dateTime } from "@/lib/format";
import { Badge, Button, Card, CardHeader, LinkButton, Notice, PageHeader, cx } from "@/components/ui";
import { ImpersonateButton } from "../../ImpersonateButton";
import { AddUserForm, ResendInvite } from "./TeamForm";

export default async function BrokerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { agency } = await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const broker = await prisma.broker.findFirst({ where: { id, agencyId: agency.id }, include: { users: { orderBy: { createdAt: "asc" } } } });
  if (!broker) notFound();
  const f = features(broker);
  const audits = await prisma.auditLog.findMany({ where: { agencyId: agency.id, targetBrokerId: broker.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={broker.companyName}
        subtitle={<>NMLS #{broker.companyNmlsId} · {licensedStates(broker).join(", ") || "no states set"} · <a className="underline" href={`/b/${broker.slug}/check`} target="_blank">{env.appUrl.replace(/^https?:\/\//, "")}/b/{broker.slug}</a></>}
        actions={<><LinkButton href={`/b/${broker.slug}/check`} target="_blank" variant="secondary">Public page</LinkButton><ImpersonateButton brokerId={broker.id} size="md" /></>}
      />
      {created && <Notice tone="good">Broker created and the welcome invite was emailed. They&apos;ll go through a 10-minute setup wizard on first sign-in, or you can impersonate and pre-fill it.</Notice>}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Account status" subtitle="No payments in MVP; flags only. Suspended brokers' public pages show “unavailable”." />
          <div className="flex flex-wrap gap-2 p-5">
            {(["TRIAL", "ACTIVE", "SUSPENDED"] as const).map((s) => (
              <form key={s} action={setBrokerStatus.bind(null, broker.id, s)}>
                <Button size="sm" variant={broker.status === s ? "primary" : "secondary"} className={cx(s === "SUSPENDED" && broker.status !== s && "text-bad")}>{s.toLowerCase()}</Button>
              </form>
            ))}
          </div>
          <div className="border-t border-line px-5 py-3 text-xs text-muted">Onboarding: step {broker.onboardingStep} of 6</div>
        </Card>
        <Card>
          <CardHeader title="Theme" subtitle="The broker can also change it in Settings → Appearance." />
          <form action={setBrokerTheme.bind(null, broker.id)} className="flex flex-wrap items-center gap-2 p-5">
            <select name="theme" defaultValue={broker.theme} aria-label="Theme" className="h-10 border border-rule bg-surface px-3 text-sm text-ink">
              {themeIds.map((t) => <option key={t} value={t}>{THEMES[t].name}</option>)}
            </select>
            <Button size="sm" variant="secondary">Apply theme</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Modules (sell tiers)" subtitle="Disabled modules disappear from the dashboard and their public pages." />
          <form action={setBrokerFeatures.bind(null, broker.id)} className="space-y-2 p-5">
            {(Object.keys(f) as FeatureKey[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={k} defaultChecked={f[k]} className="h-4 w-4 accent-[var(--accent)]" />{FEATURE_LABELS[k]}</label>
            ))}
            <Button size="sm" variant="secondary" className="mt-2">Save modules</Button>
          </form>
        </Card>
      </div>
      <Card>
        <CardHeader title="Team" subtitle="Loan officers sign in with a magic link. Each LO gets their own public links." />
        <ul className="divide-y divide-line">
          {broker.users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium">{u.name ?? "—"} {u.role === "BROKER_ADMIN" && <Badge tone="accent">admin</Badge>}</span><span className="block truncate text-xs text-muted">{u.email}{u.nmlsId ? ` · NMLS #${u.nmlsId}` : ""}</span></span>
              <ResendInvite userId={u.id} />
            </li>
          ))}
        </ul>
        <div className="border-t border-line p-5"><AddUserForm brokerId={broker.id} /></div>
      </Card>
      <Card>
        <CardHeader title="Recent admin actions" />
        <ul className="divide-y divide-line text-sm">
          {audits.length === 0 && <li className="px-5 py-4 text-muted">None yet.</li>}
          {audits.map((a) => <li key={a.id} className="flex justify-between px-5 py-2.5"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-muted">{dateTime(a.createdAt)}</span></li>)}
        </ul>
      </Card>
    </div>
  );
}
