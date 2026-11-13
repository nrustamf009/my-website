import type { Broker } from "@prisma/client";
import { forBroker, type ScopedDb } from "@/lib/db";
import { systemDb } from "@/lib/db/system";
import { hmacSha256, randomToken } from "@/lib/tokens";
import { log } from "@/lib/log";

export type WebhookEventName =
  | "lead.created"
  | "lead.updated"
  | "scenario.viewed"
  | "scenario.option_interest"
  | "snapshot.lead"
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

/** Backoff after the inline attempts: 2 min, 10 min, 1 h, 6 h. Then FAILED. */
const BACKOFF_MIN = [2, 10, 60, 360];
const INLINE_DELAYS_MS = [0, 1_000, 5_000];
export const MAX_ATTEMPTS = INLINE_DELAYS_MS.length + BACKOFF_MIN.length;

/** Queue a signed event. Returns the delivery id (or null when no webhook is configured). */
export async function queueWebhook<T>(db: ScopedDb, broker: BrokerHook, event: WebhookEventName, data: T): Promise<string | null> {
  if (!broker.webhookUrl) return null;
  const envelope: WebhookEnvelope<T> = { id: `evt_${randomToken(16)}`, event, version: 1, brokerSlug: broker.slug, occurredAt: new Date().toISOString(), data };
  const d = await db.webhookDelivery.create({ data: { brokerId: db.brokerId, eventType: event, payload: JSON.stringify(envelope), status: "PENDING", nextAttemptAt: new Date() } });
  return d.id;
}

async function post(url: string, secret: string, body: string, event: string, id: string) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DSCR-Investor-Toolkit-Webhooks/1.0",
        "X-DSCR-Event": event,
        "X-DSCR-Delivery": id,
        "X-DSCR-Signature": `sha256=${hmacSha256(secret, body)}`,
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    return { ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error ? err.name : "network error" };
  }
}

async function attemptOnce(deliveryId: string, brokerId: string): Promise<boolean> {
  const db = forBroker(brokerId);
  const d = await db.webhookDelivery.findFirst({ where: { id: deliveryId } });
  if (!d || d.status === "SUCCESS") return true;
  const broker = await systemDb.broker.findUnique({ where: { id: brokerId }, select: { webhookUrl: true, webhookSecret: true } });
  if (!broker?.webhookUrl) {
    await db.webhookDelivery.update({ where: { id: d.id }, data: { status: "FAILED", lastError: "No webhook URL configured", nextAttemptAt: null } });
    return true;
  }
  const env = JSON.parse(d.payload) as WebhookEnvelope;
  const r = await post(broker.webhookUrl, broker.webhookSecret, d.payload, env.event, env.id);
  const attempts = d.attempts + 1;
  const backoffIndex = attempts - INLINE_DELAYS_MS.length;
  const done = r.ok || attempts >= MAX_ATTEMPTS;
  await db.webhookDelivery.update({
    where: { id: d.id },
    data: {
      attempts,
      lastHttpStatus: r.status,
      lastError: r.error,
      status: r.ok ? "SUCCESS" : done ? "FAILED" : "PENDING",
      nextAttemptAt: done ? null : new Date(Date.now() + (backoffIndex >= 0 ? BACKOFF_MIN[backoffIndex]! * 60_000 : 0)),
    },
  });
  if (!r.ok) log.warn("webhook.attempt_failed", { event: env.event, attempts, status: r.status });
  return r.ok;
}

/** Inline delivery with two quick retries (≈1 s, 5 s). Further retries happen in the cron sweep. */
export async function deliverNow(deliveryId: string | null, brokerId: string) {
  if (!deliveryId) return;
  for (const delay of INLINE_DELAYS_MS) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (await attemptOnce(deliveryId, brokerId)) return;
  }
}

/** Convenience: queue + deliver inline. Use inside after() so the request isn't delayed. */
export async function dispatchWebhook<T>(db: ScopedDb, broker: BrokerHook, event: WebhookEventName, data: T) {
  const id = await queueWebhook(db, broker, event, data);
  await deliverNow(id, broker.id);
  return id;
}

/** Cron sweep: retry due PENDING deliveries across all brokers. */
export async function retryDueWebhooks(limit = 100) {
  const due = await systemDb.webhookDelivery.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: new Date() } }, take: limit, orderBy: { nextAttemptAt: "asc" } });
  let delivered = 0;
  for (const d of due) if (await attemptOnce(d.id, d.brokerId)) delivered++;
  return { checked: due.length, delivered };
}

/** Manual redeliver from the dashboard: resets the attempt counter and tries again. */
export async function redeliver(db: ScopedDb, deliveryId: string) {
  const d = await db.webhookDelivery.findFirst({ where: { id: deliveryId } });
  if (!d) return false;
  await db.webhookDelivery.update({ where: { id: d.id }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date() } });
  await deliverNow(d.id, db.brokerId);
  return true;
}
