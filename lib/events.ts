import type { ScopedDb } from "@/lib/db";

export type EventType =
  | "lead.created"
  | "lead.resubmitted"
  | "lead.status_changed"
  | "lead.deleted"
  | "check.calculated"
  | "scenario.created"
  | "scenario.shared"
  | "scenario.opened"
  | "scenario.reopened"
  | "scenario.option_expanded"
  | "scenario.interest"
  | "scenario.revoked"
  | "snapshot.created"
  | "snapshot.scanned"
  | "snapshot.stats_emailed"
  | "moneylist.imported"
  | "moneylist.drafted"
  | "moneylist.contacted"
  | "moneylist.snoozed"
  | "moneylist.not_interested"
  | "moneylist.won"
  | "notes.converted"
  | "webhook.test";

/** Append-only event log that powers dashboards, ROI emails and agency stats. */
export async function emit(db: ScopedDb, type: EventType, entityType: string, entityId: string, meta: Record<string, unknown> = {}, actorUserId?: string | null) {
  return db.event.create({ data: { brokerId: db.brokerId, type, entityType, entityId, actorUserId: actorUserId ?? null, meta: JSON.stringify(meta) } });
}
