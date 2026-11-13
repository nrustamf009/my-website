export const LEAD_STATUSES = ["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = { NEW: "New", CONTACTED: "Contacted", IN_PROGRESS: "In progress", CLOSED: "Closed", LOST: "Lost" };
export const LEAD_STATUS_TONE: Record<LeadStatus, "accent" | "good" | "warn" | "neutral" | "bad"> = { NEW: "accent", CONTACTED: "warn", IN_PROGRESS: "warn", CLOSED: "good", LOST: "neutral" };
export const LEAD_SOURCES = ["WIDGET", "SNAPSHOT", "SCENARIO", "NOTES", "MANUAL"] as const;
export const LEAD_SOURCE_LABEL: Record<string, string> = { WIDGET: "Instant Check", SNAPSHOT: "Listing QR", SCENARIO: "Scenario", NOTES: "Notes", MANUAL: "Manual" };

export interface LeadFilters {
  status?: string;
  source?: string;
  owner?: string;
  q?: string;
}

export function leadWhere(f: LeadFilters, me?: string | null) {
  const where: Record<string, unknown> = {};
  if (f.status && (LEAD_STATUSES as readonly string[]).includes(f.status)) where.status = f.status;
  if (f.source && (LEAD_SOURCES as readonly string[]).includes(f.source)) where.source = f.source;
  if (f.owner === "me" && me) where.ownerUserId = me;
  else if (f.owner && f.owner !== "all") where.ownerUserId = f.owner;
  if (f.q?.trim()) {
    const q = f.q.trim().slice(0, 80);
    where.OR = [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { propertyAddress: { contains: q } }, { phone: { contains: q } }];
  }
  return where;
}
