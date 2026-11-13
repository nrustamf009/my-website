import type { Broker, PrismaClient, User } from "@prisma/client";
import { CONSENT_TEXT, CONSENT_VERSION } from "../lib/compliance/disclaimers";
import { analyzeDeal, engineContextFromGrid } from "./engine";
import type { UsState } from "../lib/dscr";

type L = { name: string; email: string; phone: string; source: string; status: string; address: string; state: UsState; price: number; rent: number; down?: number; utm?: string; daysAgo: number; marketing?: boolean; realtor?: boolean; notes?: string };

const LEADS: Record<string, L[]> = {
  harborline: [
    { name: "Jordan Whitaker", email: "jordan.whitaker@example.com", phone: "(555) 010-5101", source: "WIDGET", status: "NEW", address: "512 Heron Bay Cir, Tampa, FL 33611", state: "FL", price: 385_000, rent: 3_550, utm: "instagram", daysAgo: 0.2, marketing: true },
    { name: "Alexis Moreau", email: "alexis.moreau@example.com", phone: "(555) 010-5102", source: "WIDGET", status: "NEW", address: "88 Bluebonnet Trl, Austin, TX 78745", state: "TX", price: 342_000, rent: 2_350, utm: "facebook", daysAgo: 0.9 },
    { name: "Sam Okafor", email: "sam.okafor@example.com", phone: "(555) 010-5103", source: "SNAPSHOT", status: "NEW", address: "4410 Bayshore Ct, Tampa, FL 33611", state: "FL", price: 412_000, rent: 3_150, daysAgo: 1.5, realtor: true },
    { name: "Taylor Brennan", email: "taylor.brennan@example.com", phone: "(555) 010-5104", source: "WIDGET", status: "CONTACTED", address: "1901 Magnolia St, Savannah, GA 31401", state: "GA", price: 268_000, rent: 2_250, utm: "biggerpockets", daysAgo: 3, notes: "Wants to close before year end. Has 2 doors already." },
    { name: "Morgan Ellis", email: "morgan.ellis@example.com", phone: "(555) 010-5105", source: "WIDGET", status: "IN_PROGRESS", address: "77 Pecan Grove Rd, San Antonio, TX 78249", state: "TX", price: 299_000, rent: 2_350, down: 2_000, daysAgo: 6, marketing: true },
    { name: "Drew Castillo", email: "drew.castillo@example.com", phone: "(555) 010-5106", source: "SNAPSHOT", status: "CONTACTED", address: "2209 Live Oak Trl, San Antonio, TX 78249", state: "TX", price: 289_000, rent: 2_250, daysAgo: 8, realtor: true },
    { name: "Casey Lindqvist", email: "casey.lindqvist@example.com", phone: "(555) 010-5107", source: "MANUAL", status: "CLOSED", address: "330 Saltmarsh Way, Charlotte, NC 28205", state: "NC", price: 315_000, rent: 2_500, daysAgo: 21 },
    { name: "Robin Achterberg", email: "robin.achterberg@example.com", phone: "(555) 010-5108", source: "WIDGET", status: "LOST", address: "15 Cedar Ridge Ln, Raleigh, NC 27603", state: "NC", price: 455_000, rent: 2_400, daysAgo: 12, notes: "Went with a conventional loan; DSCR too thin." },
    { name: "Kai Montgomery", email: "kai.montgomery@example.com", phone: "(555) 010-5109", source: "WIDGET", status: "NEW", address: "940 Juniper Ct, Jacksonville, FL 32207", state: "FL", price: 236_000, rent: 2_250, utm: "google", daysAgo: 9 },
  ],
  "cactus-ridge": [
    { name: "Lena Vasquez", email: "lena.vasquez@example.com", phone: "(555) 010-5201", source: "WIDGET", status: "NEW", address: "7720 Saguaro Ln, Phoenix, AZ 85032", state: "AZ", price: 365_000, rent: 2_300, daysAgo: 2 },
    { name: "Noah Pratt", email: "noah.pratt@example.com", phone: "(555) 010-5202", source: "WIDGET", status: "CONTACTED", address: "18 Mesa View Dr, Las Vegas, NV 89123", state: "NV", price: 410_000, rent: 2_650, daysAgo: 5 },
  ],
  "evergreen-key": [
    { name: "Ivy Halvorsen", email: "ivy.halvorsen@example.com", phone: "(555) 010-5301", source: "WIDGET", status: "NEW", address: "2210 Fir St, Tacoma, WA 98405", state: "WA", price: 449_000, rent: 2_800, daysAgo: 1 },
  ],
};

export async function seedLeads(prisma: PrismaClient, broker: Broker, users: User[]) {
  const ctx = engineContextFromGrid(broker);
  const realtor = await prisma.realtor.findFirst({ where: { brokerId: broker.id } });
  const snapshot = realtor ? await prisma.snapshot.findFirst({ where: { brokerId: broker.id, realtorId: realtor.id } }) : null;
  const list = LEADS[broker.slug] ?? [];
  const DAY = 86_400_000;
  for (const [i, x] of list.entries()) {
    const form = { mode: "PURCHASE", address: x.address, state: x.state, propertyType: "SFR", units: 1, use: "LTR", fico: i % 3 ? "740+" : "700-739", priceCents: x.price * 100, downPaymentRatio: x.down ?? 2_500, rentCents: x.rent * 100, product: "FIXED30", prepay: "5-4-3-2-1" };
    const a = x.source === "MANUAL" ? null : analyzeDeal({ mode: "PURCHASE", state: x.state, fico: form.fico as "740+", priceCents: form.priceCents, downPaymentRatio: form.downPaymentRatio, rentCents: form.rentCents, product: "FIXED30", prepay: "5-4-3-2-1" }, ctx);
    const at = new Date(Date.now() - x.daysAgo * DAY);
    const web = x.source === "WIDGET" || x.source === "SNAPSHOT";
    const lead = await prisma.lead.create({
      data: {
        brokerId: broker.id,
        ownerUserId: users[i % users.length]!.id,
        source: x.source,
        status: x.status,
        name: x.name,
        email: x.email,
        phone: x.phone,
        phoneE164: `+1${x.phone.replace(/\D/g, "")}`,
        propertyAddress: x.address,
        state: x.state,
        engineInput: a ? JSON.stringify(form) : "{}",
        engineOutput: a ? JSON.stringify({ verdict: a.verdict, dscrRatio: a.dscrRatio, pitiaCents: a.pitiaCents, loanAmountCents: a.loanAmountCents, rateMilli: a.rateMilli, maxLoanCents: a.maxLoanCents, cashFlowCents: a.cashFlowCents, totalCashNeededCents: a.totalCashNeededCents }) : "{}",
        utmSource: x.utm ?? null,
        utmMedium: x.utm ? "social" : null,
        realtorId: x.realtor && realtor ? realtor.id : null,
        snapshotId: x.realtor && snapshot ? snapshot.id : null,
        disclaimerVersionId: web ? broker.currentDisclaimerId : null,
        notes: x.notes ?? null,
        createdAt: at,
        consents: web
          ? {
              create: (["CONTACT", "INVESTMENT_PROPERTY", "MARKETING"] as const).map((kind) => ({ brokerId: broker.id, kind, textVersion: CONSENT_VERSION, text: kind === "INVESTMENT_PROPERTY" ? CONSENT_TEXT.INVESTMENT_PROPERTY : CONSENT_TEXT[kind](broker.companyName), granted: kind !== "MARKETING" || !!x.marketing, ip: "seed", userAgent: "seed", createdAt: at })),
            }
          : undefined,
      },
    });
    await prisma.event.create({ data: { brokerId: broker.id, type: "lead.created", entityType: "Lead", entityId: lead.id, meta: JSON.stringify({ source: x.source, verdict: a?.verdict ?? null }), createdAt: at } });
    if (x.status !== "NEW") await prisma.event.create({ data: { brokerId: broker.id, type: "lead.status_changed", entityType: "Lead", entityId: lead.id, actorUserId: users[0]!.id, meta: JSON.stringify({ from: "NEW", to: x.status }), createdAt: new Date(at.getTime() + 3 * 3_600_000) } });
  }
  // Anonymous Instant Check runs this week and last week (ROI tiles).
  for (let k = 0; k < (broker.slug === "harborline" ? 46 : 12); k++) {
    await prisma.event.create({ data: { brokerId: broker.id, type: "check.calculated", entityType: "Broker", entityId: broker.id, meta: JSON.stringify({ verdict: ["STRONG", "BORDERLINE", "NEEDS_ADJUSTMENT"][k % 3] }), createdAt: new Date(Date.now() - ((k * 0.3) % 13) * DAY) } });
  }
  return { leads: list.length };
}
