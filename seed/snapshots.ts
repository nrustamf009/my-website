import type { Broker, PrismaClient, User } from "@prisma/client";
import { DEFAULT_CONTEXT, estimateEscrow, gridRate, normalizeGrid, type UsState } from "../lib/dscr";

const REALTORS: Record<string, { name: string; brokerage: string; email: string; phone: string }[]> = {
  harborline: [
    { name: "Dana Whitfield", brokerage: "Coastline Realty Group", email: "dana@coastline-realty.example", phone: "(555) 010-3301" },
    { name: "Marco Ellison", brokerage: "Gulfview Homes", email: "marco@gulfview.example", phone: "(555) 010-3302" },
  ],
  "cactus-ridge": [{ name: "Alma Reyes", brokerage: "Saguaro Properties", email: "alma@saguaro.example", phone: "(555) 010-3303" }],
  "evergreen-key": [{ name: "Owen Brandt", brokerage: "Cascade Home Partners", email: "owen@cascadehomes.example", phone: "(555) 010-3304" }],
};

const LISTINGS: Record<string, { address: string; state: UsState; price: number; rent: number; type?: string; hoa?: number; template?: string }[]> = {
  harborline: [
    { address: "4410 Bayshore Ct, Tampa, FL 33611", state: "FL", price: 412_000, rent: 3_150 },
    { address: "2209 Live Oak Trl, San Antonio, TX 78249", state: "TX", price: 289_000, rent: 2_250, template: "MODERN" },
    { address: "81 Magnolia St Unit 4, Savannah, GA 31401", state: "GA", price: 245_000, rent: 2_050, type: "CONDO", hoa: 285 },
    { address: "1517 Duplex Row, Charlotte, NC 28205", state: "NC", price: 465_000, rent: 3_700, type: "2-4", template: "MODERN" },
  ],
  "cactus-ridge": [{ address: "9021 Desert Willow Trl, Tucson, AZ 85743", state: "AZ", price: 355_000, rent: 2_400 }],
  "evergreen-key": [{ address: "3318 Alder Ct, Spokane, WA 99203", state: "WA", price: 398_000, rent: 2_700 }],
};

export async function seedSnapshots(prisma: PrismaClient, broker: Broker, users: User[]) {
  const realtors = [];
  for (const r of REALTORS[broker.slug] ?? []) realtors.push(await prisma.realtor.create({ data: { ...r, brokerId: broker.id } }));
  if (!realtors.length) return { realtors: 0, snapshots: 0 };
  const grid = normalizeGrid(JSON.parse(broker.programGrid ?? "null"));
  const rate = gridRate(grid, { mode: "PURCHASE", fico: "740+", bucket: ">=1.20", product: "FIXED30", prepay: "5-4-3-2-1", pointsRatio: 0 });
  let scans = 0;
  const list = LISTINGS[broker.slug] ?? [];
  for (const [i, l] of list.entries()) {
    const esc = estimateEscrow(l.state, l.price * 100, DEFAULT_CONTEXT);
    const created = new Date(Date.now() - (20 - i * 4) * 86_400_000);
    const snap = await prisma.snapshot.create({
      data: {
        brokerId: broker.id,
        ownerUserId: users[i % users.length]!.id,
        realtorId: realtors[i % realtors.length]!.id,
        token: `demo${broker.slug.slice(0, 4)}${i}${Math.random().toString(36).slice(2, 8)}`,
        template: l.template ?? "CLASSIC",
        address: l.address,
        state: l.state,
        propertyType: l.type ?? "SFR",
        listPriceCents: l.price * 100,
        rentCents: l.rent * 100,
        rentSource: i % 2 ? "MANUAL" : "PROVIDER",
        taxesAnnualCents: esc.taxesAnnualCents,
        insuranceAnnualCents: esc.insuranceAnnualCents,
        hoaMonthlyCents: (l.hoa ?? 0) * 100,
        rateMilli: rate,
        createdAt: created,
      },
    });
    await prisma.event.create({ data: { brokerId: broker.id, type: "snapshot.created", entityType: "Snapshot", entityId: snap.id, actorUserId: users[0]!.id, createdAt: created } });
    const n = [14, 9, 3, 6][i] ?? 2;
    for (let k = 0; k < n; k++) {
      await prisma.event.create({ data: { brokerId: broker.id, type: "snapshot.scanned", entityType: "Snapshot", entityId: snap.id, meta: JSON.stringify({ realtorId: snap.realtorId, src: k % 4 ? "qr" : "link", device: k % 3 ? "mobile" : "desktop" }), createdAt: new Date(created.getTime() + (k + 1) * 18 * 3_600_000) } });
      scans++;
    }
  }
  return { realtors: realtors.length, snapshots: list.length, scans };
}
