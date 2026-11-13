import { requireBroker } from "@/lib/auth/session";
import { notificationEmails } from "@/lib/broker";
import { redeliverAction, rotateWebhookSecret } from "@/lib/actions/settings";
import { relativeTime } from "@/lib/format";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { NotificationsForm, WebhookForm } from "@/components/settings/forms";

export const metadata = { title: "Notifications & webhooks" };

export default async function Integrations() {
  const { broker, db } = await requireBroker({ manage: true });
  const deliveries = await db.webhookDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <>
      <NotificationsForm broker={broker} emails={notificationEmails(broker)} />
      <WebhookForm broker={broker} />
      <Card>
        <CardHeader title="Webhook signing secret & delivery log" subtitle="Failed deliveries retry automatically (about 1 s, 5 s, 2 min, 10 min, 1 h, 6 h)." />
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 text-sm">
          <code className="rounded bg-ink/5 px-2 py-1 text-xs">{broker.webhookSecret.slice(0, 12)}••••••••</code>
          <CopyButton text={broker.webhookSecret} label="Copy secret" />
          <form action={rotateWebhookSecret}><Button size="sm" variant="ghost">Rotate</Button></form>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {deliveries.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">No deliveries yet.</li>}
          {deliveries.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
              <span className="font-mono text-xs">{d.eventType}</span>
              <span className="flex items-center gap-2">
                <Badge tone={d.status === "SUCCESS" ? "good" : d.status === "PENDING" ? "warn" : "bad"}>{d.status === "SUCCESS" ? `HTTP ${d.lastHttpStatus}` : d.status === "PENDING" ? `retrying (${d.attempts})` : d.lastHttpStatus ? `HTTP ${d.lastHttpStatus}` : d.lastError ?? "failed"}</Badge>
                <span className="text-xs text-muted">{relativeTime(d.createdAt)}</span>
                {d.status !== "SUCCESS" && <form action={redeliverAction.bind(null, d.id)}><Button size="sm" variant="ghost">Redeliver</Button></form>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
