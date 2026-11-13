import type { Broker, PrismaClient, User } from "@prisma/client";
import { DEFAULT_CONTEXT, estimateEscrow, loanForLtv, normalizeGrid, priceScenarioOption, type FicoBucket, type Mode, type Prepay, type Product, type UsState } from "../lib/dscr";

type Seed = { investor: string; email: string; phone: string; address: string; state: UsState; mode: Mode; value: number; balance?: number; rent: number; fico: FicoBucket; ltv: number; opts: [Product, Prepay, number][]; opens: number[]; pick?: number; question?: string; daysAgo: number; status?: string };

const SCENARIOS: Record<string, Seed[]> = {
  harborline: [
    { investor: "Marcus Bellweather", email: "marcus.bellweather@example.com", phone: "(555) 010-4410", address: "2714 Palmetto Grove Way, Tampa, FL 33610", state: "FL", mode: "PURCHASE", value: 468_000, rent: 3_850, fico: "740+", ltv: 7_500, opts: [["FIXED30", "5-4-3-2-1", 0], ["IO30", "5-4-3-2-1", 0], ["FIXED30", "5-4-3-2-1", 100]], opens: [3, 1, 0.1], pick: 2, question: "Can we close in 5 weeks with the 3-2-1?", daysAgo: 4 },
    { investor: "Renata Okonjo", email: "renata.okonjo@example.com", phone: "(555) 010-4411", address: "608 Cypress Ln, Houston, TX 77008", state: "TX", mode: "CASH_OUT", value: 515_000, balance: 238_000, rent: 3_400, fico: "700-739", ltv: 7_000, opts: [["FIXED30", "5-4-3-2-1", 0], ["IO30", "5-4-3-2-1", 0]], opens: [1.5, 0.4], daysAgo: 2 },
    { investor: "Eli Sandoval", email: "eli.sandoval@example.com", phone: "(555) 010-4412", address: "45 Juniper Ct, Charlotte, NC 28203", state: "NC", mode: "PURCHASE", value: 329_000, rent: 2_450, fico: "740+", ltv: 8_000, opts: [["FIXED30", "5-4-3-2-1", 0], ["ARM5_6", "3-2-1", 0], ["IO30", "5-4-3-2-1", 50]], opens: [6], daysAgo: 7 },
    { investor: "Priya Natarajan", email: "priya.natarajan@example.com", phone: "(555) 010-4413", address: "1200 Sable Palm Way, Orlando, FL 32803", state: "FL", mode: "RATE_TERM", value: 410_000, balance: 290_000, rent: 2_900, fico: "740+", ltv: 7_100, opts: [["FIXED30", "3-2-1", 0], ["FIXED30", "NONE", 0]], opens: [], daysAgo: 1, status: "DRAFT" },
  ],
  "cactus-ridge": [
    { investor: "Tomas Herrera", email: "tomas.herrera@example.com", phone: "(555) 010-4414", address: "9021 Desert Willow Trl, Tucson, AZ 85743", state: "AZ", mode: "CASH_OUT", value: 415_000, balance: 205_000, rent: 2_375, fico: "680-699", ltv: 7_000, opts: [["FIXED30", "5-4-3-2-1", 0], ["IO30", "5-4-3-2-1", 0]], opens: [2.2, 0.2], pick: 0, daysAgo: 3 },
  ],
};

export async function seedScenarios(prisma: PrismaClient, broker: Broker, users: User[]) {
  const grid = normalizeGrid(JSON.parse(broker.programGrid || "null"));
  const list = SCENARIOS[broker.slug] ?? [];
  const DAY = 86_400_000;
  for (const [i, x] of list.entries()) {
    const esc = estimateEscrow(x.state, x.value * 100, DEFAULT_CONTEXT);
    const prop = { mode: x.mode, valueCents: x.value * 100, rentCents: x.rent * 100, taxesAnnualCents: esc.taxesAnnualCents, insuranceAnnualCents: esc.insuranceAnnualCents, hoaMonthlyCents: 0, currentBalanceCents: x.balance ? x.balance * 100 : null };
    const loan = loanForLtv(prop.valueCents, x.ltv);
    const created = new Date(Date.now() - x.daysAgo * DAY);
    const owner = users[i % users.length]!;
    const s = await prisma.scenario.create({
      data: {
        brokerId: broker.id,
        ownerUserId: owner.id,
        token: `demo${broker.slug.slice(0, 3)}${i}${Math.random().toString(36).slice(2, 10)}`,
        status: x.status ?? "SHARED",
        mode: x.mode,
        investorName: x.investor,
        investorEmail: x.email,
        investorPhone: x.phone,
        propertyAddress: x.address,
        state: x.state,
        valueCents: prop.valueCents,
        currentBalanceCents: prop.currentBalanceCents,
        rentCents: prop.rentCents,
        taxesAnnualCents: prop.taxesAnnualCents,
        insuranceAnnualCents: prop.insuranceAnnualCents,
        ficoBucket: x.fico,
        note: i === 0 ? "Option C buys the rate down with 1 point; it pays for itself in about 30 months if you hold." : null,
        createdAt: created,
        expiresAt: new Date(created.getTime() + 30 * DAY),
        firstOpenedAt: x.opens.length ? new Date(Date.now() - x.opens[0]! * DAY) : null,
        options: {
          create: x.opts.map(([product, prepay, pointsRatio], j) => {
            const o = { product, prepay, pointsRatio, feesCents: 149_500, loanAmountCents: loan };
            return { ...o, label: "ABC"[j]!, sortOrder: j, recommended: j === 0, rateMilli: priceScenarioOption(prop, o, grid, x.fico) };
          }),
        },
        views: { create: x.opens.map((d, k) => ({ visitKey: `seed${s4()}${k}`, device: k % 2 ? "desktop" : "mobile", startedAt: new Date(Date.now() - d * DAY), lastSeenAt: new Date(Date.now() - d * DAY + 180_000), activeSeconds: 95 + k * 70 })) },
      },
      include: { options: true },
    });
    const ev = (type: string, at: Date, meta: object = {}) => prisma.event.create({ data: { brokerId: broker.id, type, entityType: "Scenario", entityId: s.id, meta: JSON.stringify(meta), createdAt: at } });
    await ev("scenario.created", created);
    if (s.status === "SHARED") await ev("scenario.shared", new Date(created.getTime() + 600_000));
    for (const [k, d] of x.opens.entries()) {
      const at = new Date(Date.now() - d * DAY);
      await ev(k === 0 ? "scenario.opened" : "scenario.reopened", at, { device: k % 2 ? "desktop" : "mobile" });
      await ev("scenario.option_expanded", new Date(at.getTime() + 60_000), { optionId: s.options[k % s.options.length]!.id });
    }
    if (x.pick != null) {
      const opt = s.options.find((o) => o.sortOrder === x.pick)!;
      const at = new Date(Date.now() - (x.opens[x.opens.length - 1] ?? 0) * DAY + 240_000);
      await prisma.scenario.update({ where: { id: s.id }, data: { interestedOptionId: opt.id, interestedAt: at, interestQuestion: x.question ?? null } });
      await ev("scenario.interest", at, { optionId: opt.id, label: opt.label });
    }
  }
  return { scenarios: list.length };
}

function s4() {
  return Math.random().toString(36).slice(2, 10);
}
