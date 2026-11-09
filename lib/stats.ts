import { prisma } from "@/lib/db";
import { evaluateAll, settingsFromBroker } from "@/lib/dscr";

export interface BrokerStats {
  leads: number;
  leads30: number;
  scenarios: number;
  opens: number;
  snapshots: number;
  scans: number;
  opportunities: number;
  closedLoans: number;
}

/** Per-broker usage stats for the agency admin and the broker overview. */
export async function brokerStats(brokerIds: string[]): Promise<Map<string, BrokerStats>> {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [leads, leads30, scenarios, opens, snapshots, scans, brokers] = await Promise.all([
    prisma.lead.groupBy({ by: ["brokerId"], where: { brokerId: { in: brokerIds } }, _count: true }),
    prisma.lead.groupBy({ by: ["brokerId"], where: { brokerId: { in: brokerIds }, createdAt: { gte: since } }, _count: true }),
    prisma.scenario.groupBy({ by: ["brokerId"], where: { brokerId: { in: brokerIds } }, _count: true }),
    prisma.scenarioView.findMany({ where: { scenario: { brokerId: { in: brokerIds } } }, select: { scenario: { select: { brokerId: true } } } }),
    prisma.snapshot.groupBy({ by: ["brokerId"], where: { brokerId: { in: brokerIds } }, _count: true }),
    prisma.snapshotScan.findMany({ where: { snapshot: { brokerId: { in: brokerIds } } }, select: { snapshot: { select: { brokerId: true } } } }),
    prisma.broker.findMany({ where: { id: { in: brokerIds } }, include: { closedLoans: { where: { contactedAt: null } } } }),
  ]);
  const count = (rows: { brokerId: string; _count: number }[], id: string) => rows.find((r) => r.brokerId === id)?._count ?? 0;
  const map = new Map<string, BrokerStats>();
  for (const b of brokers) {
    map.set(b.id, {
      leads: count(leads, b.id),
      leads30: count(leads30, b.id),
      scenarios: count(scenarios, b.id),
      opens: opens.filter((o) => o.scenario.brokerId === b.id).length,
      snapshots: count(snapshots, b.id),
      scans: scans.filter((s) => s.snapshot.brokerId === b.id).length,
      opportunities: evaluateAll(b.closedLoans, settingsFromBroker(b)).length,
      closedLoans: b.closedLoans.length,
    });
  }
  return map;
}
