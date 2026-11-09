import type { Broker } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hmacSha256, randomToken } from "@/lib/tokens";
import { log } from "@/lib/log";

export type WebhookEventName =
  | "lead.created"
  | "scenario.viewed"
  | "scenario.option_interest"
  | "money_list.contacted"
  | "test";

export interface WebhookEnvelope<T = unknown> {
  id: string;
  event: WebhookEventName;
  version: 1;
  brokerSlug: string;
  occurredAt: string;
  data: T;
}

type BrokerHook = Pick<Broker, "id" | "slug" | "webhookUrl" | "webhookSecret">;

/** Sign and POST a JSON event to the broker's webhook URL; log the delivery. Never throws. */
export async function dispatchWebhook<T>(broker: BrokerHook, event: WebhookEventName, data: T): Promise<{ ok: boolean; status?: number }> {
  if (!broker.webhookUrl) return { ok: false };
  const envelope: WebhookEnvelope<T> = {
    id: `evt_${randomToken(16)}`,
    event,
    version: 1,
    brokerSlug: broker.slug,
    occurredAt: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(envelope);
  let status: number | undefined;
  let ok = false;
  try {
    const res = await fetch(broker.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DSCR-Investor-Toolkit-Webhooks/1.0",
        "X-DSCR-Event": event,
        "X-DSCR-Delivery": envelope.id,
        "X-DSCR-Signature": `sha256=${hmacSha256(broker.webhookSecret, body)}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    status = res.status;
    ok = res.ok;
  } catch (err) {
    log.warn("webhook.delivery_error", { event, error: err instanceof Error ? err.name : "unknown" });
  }
  await prisma.webhookDelivery.create({
    data: { brokerId: broker.id, event, payload: body, status: ok ? "SUCCESS" : "FAILED", httpStatus: status ?? null },
  });
  return { ok, status };
}

export async function redeliverWebhook(deliveryId: string, brokerId: string) {
  const d = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, brokerId }, include: { broker: true } });
  if (!d) return { ok: false };
  const envelope = JSON.parse(d.payload) as WebhookEnvelope;
  return dispatchWebhook(d.broker, envelope.event, envelope.data);
}
