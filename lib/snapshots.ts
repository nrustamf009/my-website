import type { ScopedDb } from "@/lib/db";

export interface RealtorStats {
  realtorId: string;
  snapshots: number;
  scans: number;
  scans30: number;
  leads: number;
  lastActivity: Date | null;
  top: { id: string; address: string; scans: number; leads: number }[];
}

/** Scan counts per snapshot (from snapshot.scanned events). */
export async function scansBySnapshot(db: ScopedDb, snapshotIds: string[], since?: Date) {
  if (!snapshotIds.length) return new Map<string, { count: number; last: Date | null }>();
  const rows = await db.event.groupBy({
    by: ["entityId"],
    where: { type: "snapshot.scanned", entityId: { in: snapshotIds }, ...(since ? { createdAt: { gte: since } } : {}) },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  return new Map(rows.map((r) => [r.entityId, { count: r._count._all, last: r._max.createdAt }]));
}

export async function realtorStats(db: ScopedDb, realtorIds?: string[]): Promise<RealtorStats[]> {
  const realtors = await db.realtor.findMany({
    where: realtorIds ? { id: { in: realtorIds } } : {},
    include: { snapshots: { select: { id: true, address: true, createdAt: true, _count: { select: { leads: true } } } }, leads: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });
  const ids = realtors.flatMap((r) => r.snapshots.map((s) => s.id));
  const [all, recent] = await Promise.all([scansBySnapshot(db, ids), scansBySnapshot(db, ids, new Date(Date.now() - 30 * 86_400_000))]);
  return realtors.map((r) => {
    const top = r.snapshots
      .map((s) => ({ id: s.id, address: s.address, scans: all.get(s.id)?.count ?? 0, leads: s._count.leads }))
      .sort((a, b) => b.scans - a.scans || b.leads - a.leads)
      .slice(0, 5);
    const times = [...r.snapshots.map((s) => s.createdAt), ...r.snapshots.map((s) => all.get(s.id)?.last ?? null), r.leads[0]?.createdAt ?? null].filter((d): d is Date => !!d);
    return {
      realtorId: r.id,
      snapshots: r.snapshots.length,
      scans: r.snapshots.reduce((n, s) => n + (all.get(s.id)?.count ?? 0), 0),
      scans30: r.snapshots.reduce((n, s) => n + (recent.get(s.id)?.count ?? 0), 0),
      leads: r.snapshots.reduce((n, s) => n + s._count.leads, 0),
      lastActivity: times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null,
      top,
    };
  });
}
