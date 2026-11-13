import { CONSENT_TEXT, CONSENT_VERSION } from "./disclaimers";
import type { ScopedDb } from "@/lib/db";

/** Store consent evidence: exact text, version, timestamp, IP and user agent. */
export async function recordConsents(db: ScopedDb, p: { leadId: string; company: string; ip: string; userAgent: string; contact: boolean; marketing: boolean; investment: boolean }) {
  const rows = [
    { kind: "CONTACT", text: CONSENT_TEXT.CONTACT(p.company), granted: p.contact },
    { kind: "MARKETING", text: CONSENT_TEXT.MARKETING(p.company), granted: p.marketing },
    { kind: "INVESTMENT_PROPERTY", text: CONSENT_TEXT.INVESTMENT_PROPERTY, granted: p.investment },
  ];
  await db.consent.createMany({
    data: rows.map((r) => ({ ...r, brokerId: db.brokerId, leadId: p.leadId, textVersion: CONSENT_VERSION, ip: p.ip, userAgent: p.userAgent.slice(0, 400) })),
  });
}
