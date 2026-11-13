/** Cross-tenant isolation: one broker's scoped client can never read or write another broker's rows. Needs the seeded DB. */
import { afterAll, describe, expect, it } from "vitest";
import { forBroker, forBrokers, prisma } from "@/lib/db";

const brokers = async () => {
  const [a, b] = await Promise.all([prisma.broker.findUniqueOrThrow({ where: { slug: "harborline" } }), prisma.broker.findUniqueOrThrow({ where: { slug: "cactus-ridge" } })]);
  return { a, b, A: forBroker(a.id), B: forBroker(b.id) };
};

describe("tenant isolation (forBroker)", () => {
  afterAll(() => prisma.$disconnect());

  it("reads are filtered to the broker", async () => {
    const { a, b, A, B } = await brokers();
    const leadA = await prisma.lead.findFirstOrThrow({ where: { brokerId: a.id } });
    expect(await B.lead.findFirst({ where: { id: leadA.id } })).toBeNull();
    expect(await A.lead.findFirst({ where: { id: leadA.id } })).not.toBeNull();
    expect((await B.closedLoan.findMany()).every((l) => l.brokerId === b.id)).toBe(true);
    // An explicit foreign brokerId is overridden by the scope: B still sees only its own rows.
    expect(await B.lead.count({ where: { brokerId: a.id } })).toBe(await prisma.lead.count({ where: { brokerId: b.id } }));
  });

  it("child models are scoped through the parent", async () => {
    const { a, B } = await brokers();
    const opt = await prisma.scenarioOption.findFirstOrThrow({ where: { scenario: { brokerId: a.id } } });
    expect(await B.scenarioOption.findFirst({ where: { id: opt.id } })).toBeNull();
    const change = await prisma.loanStatusChange.findFirstOrThrow({ where: { loan: { brokerId: a.id } } });
    expect(await B.loanStatusChange.findFirst({ where: { id: change.id } })).toBeNull();
  });

  it("updates and deletes can't touch another tenant", async () => {
    const { a, B } = await brokers();
    const leadA = await prisma.lead.findFirstOrThrow({ where: { brokerId: a.id } });
    expect((await B.lead.updateMany({ where: { id: leadA.id }, data: { notes: "hijack" } })).count).toBe(0);
    await expect(B.lead.update({ where: { id: leadA.id }, data: { notes: "hijack" } })).rejects.toThrow();
    expect((await B.lead.deleteMany({ where: { id: leadA.id } })).count).toBe(0);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadA.id } })).notes).not.toBe("hijack");
  });

  it("creates are stamped with the broker and cross-tenant writes are blocked", async () => {
    const { a, b, B } = await brokers();
    await expect(B.realtor.create({ data: { brokerId: a.id, name: "X", brokerage: "Y" } })).rejects.toThrow(/Cross-tenant/);
    const r = await B.realtor.create({ data: { name: "Tenant Probe", brokerage: "Probe Realty" } as never });
    expect(r.brokerId).toBe(b.id);
    await prisma.realtor.delete({ where: { id: r.id } });
    await expect(B.scenarioOption.create({ data: {} as never })).rejects.toThrow(/through its parent/);
  });

  it("multi-broker (agency) scope reads only the listed brokers and can't create", async () => {
    const { a, b } = await brokers();
    const ev = await prisma.broker.findUniqueOrThrow({ where: { slug: "evergreen-key" } });
    const multi = forBrokers([a.id, b.id]);
    const ids = new Set((await multi.lead.findMany({ select: { brokerId: true } })).map((l) => l.brokerId));
    expect(ids.has(ev.id)).toBe(false);
    await expect(multi.realtor.create({ data: { name: "X", brokerage: "Y" } as never })).rejects.toThrow(/multi-broker/);
  });
});
