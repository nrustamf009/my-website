import type { Broker } from "@prisma/client";
import { forBroker, forBrokers, type ScopedDb } from "@/lib/db";
import { buildMoneyList } from "@/lib/moneylist/list";

export interface RoiStats {
  leads: number;
  leadsBySource: Record<string, number>;
  scenarioOpens: number;
  scenarioInterest: number;
  snapshotScans: number;
  moneyListContacted: number;
  moneyListWon: number;
  checks: number;
}

const DAY = 86_400_000;

/** ROI metrics from the event log for [from, to). */
export async function roiStats(db: ScopedDb | ReturnType<typeof forBrokers>, from: Date, to: Date = new Date()): Promise<RoiStats> {
  const where = { createdAt: { gte: from, lt: to } };
  const [byType, leadSources] = await Promise.all([
    db.event.groupBy({ by: ["type"], where, _count: true }),
    db.lead.groupBy({ by: ["source"], where, _count: true }),
  ]);
  const c = (t: string | string[]) => byType.filter((r) => (Array.isArray(t) ? t : [t]).includes(r.type)).reduce((s, r) => s + r._count, 0);
  const leadsBySource = Object.fromEntries(leadSources.map((r) => [r.source, r._count]));
  return {
    leads: Object.values(leadsBySource).reduce((a, b) => a + b, 0),
    leadsBySource,
    scenarioOpens: c(["scenario.opened", "scenario.reopened"]),
    scenarioInterest: c("scenario.interest"),
    snapshotScans: c("snapshot.scanned"),
    moneyListContacted: c("moneylist.contacted"),
    moneyListWon: c("moneylist.won"),
    checks: c("check.calculated"),
  };
}

export function periods() {
  const now = new Date();
  return {
    thisWeek: new Date(now.getTime() - 7 * DAY),
    lastWeek: new Date(now.getTime() - 14 * DAY),
    thisMonth: new Date(now.getTime() - 30 * DAY),
    now,
  };
}

/** Per-broker summary for the agency admin. */
export async function agencyBrokerStats(brokers: Broker[]) {
  const ids = brokers.map((b) => b.id);
  const multi = forBrokers(ids);
  const since = periods().thisMonth;
  const [leads30, events30, lastEvent] = await Promise.all([
    multi.lead.groupBy({ by: ["brokerId"], where: { createdAt: { gte: since } }, _count: true }),
    multi.event.groupBy({ by: ["brokerId", "type"], where: { createdAt: { gte: since } }, _count: true }),
    multi.event.groupBy({ by: ["brokerId"], _max: { createdAt: true } }),
  ]);
  const out = new Map<string, { leads30: number; opens30: number; scans30: number; contacted30: number; opportunities: number; lastActivity: Date | null }>();
  for (const b of brokers) {
    const ev = (types: string[]) => events30.filter((e) => e.brokerId === b.id && types.includes(e.type)).reduce((s, e) => s + e._count, 0);
    const ml = await buildMoneyList(forBroker(b.id), b);
    out.set(b.id, {
      leads30: leads30.find((r) => r.brokerId === b.id)?._count ?? 0,
      opens30: ev(["scenario.opened", "scenario.reopened"]),
      scans30: ev(["snapshot.scanned"]),
      contacted30: ev(["moneylist.contacted"]),
      opportunities: ml.rows.length,
      lastActivity: lastEvent.find((r) => r.brokerId === b.id)?._max.createdAt ?? null,
    });
  }
  return out;
}
