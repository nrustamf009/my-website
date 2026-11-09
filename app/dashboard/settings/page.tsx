import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { brokerDefaults, parseJson } from "@/lib/broker";
import { relativeTime } from "@/lib/format";
import { redeliver, rotateWebhookSecret } from "@/lib/actions/settings";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { TestWebhookButton } from "@/components/settings/WebhookTools";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { broker } = await requireBroker();
  const deliveries = await prisma.webhookDelivery.findMany({ where: { brokerId: broker.id }, orderBy: { createdAt: "desc" }, take: 10 });
  const embedScript = `<script src="${env.appUrl}/b/${broker.slug}/embed.js" async></script>`;
  const embedIframe = `<iframe src="${env.appUrl}/b/${broker.slug}/embed/check" style="width:100%;min-height:1100px;border:0" title="DSCR Instant Check"></iframe>`;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" subtitle="Branding, compliance text, underwriting defaults and integrations." />
      <SettingsForm broker={broker} caps={brokerDefaults(broker).ficoLtvCaps} seasoning={parseJson<number[]>(broker.seasoningMonths, [6, 12])} />

      <Card id="embed">
        <CardHeader title="Embed the Instant Check on your website" subtitle="Paste one of these where you want the calculator to appear." />
        <div className="space-y-4 p-5">
          {[["Script (auto-resizing)", embedScript], ["Plain iframe", embedIframe]].map(([label, code]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-sm font-medium text-ink-2">{label}<CopyButton text={code!} /></div>
              <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-xs text-white">{code}</pre>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Webhooks" subtitle="Events: lead.created, scenario.viewed, scenario.option_interest, money_list.contacted, test" action={<TestWebhookButton />} />
        <div className="space-y-3 p-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Signing secret:</span>
            <code className="rounded bg-black/5 px-2 py-1 text-xs">{broker.webhookSecret.slice(0, 10)}••••••••</code>
            <CopyButton text={broker.webhookSecret} label="Copy secret" />
            <form action={rotateWebhookSecret}><Button size="sm" variant="ghost">Rotate</Button></form>
          </div>
          <p className="text-xs text-muted">Verify with HMAC-SHA256 of the raw body using this secret; compare to the <code>X-DSCR-Signature: sha256=…</code> header.</p>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {deliveries.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">No deliveries yet.</li>}
          {deliveries.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="font-mono text-xs">{d.event}</span>
              <span className="flex items-center gap-2">
                <Badge tone={d.status === "SUCCESS" ? "good" : "bad"}>{d.status === "SUCCESS" ? `HTTP ${d.httpStatus}` : d.httpStatus ? `HTTP ${d.httpStatus}` : "No response"}</Badge>
                <span className="text-xs text-muted">{relativeTime(d.createdAt)}</span>
                {d.status !== "SUCCESS" && <form action={redeliver.bind(null, d.id)}><Button size="sm" variant="ghost">Redeliver</Button></form>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
