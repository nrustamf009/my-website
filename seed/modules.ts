import type { Broker, PrismaClient, User } from "@prisma/client";
import { seedMoneyList } from "./moneylist";
import { seedSnapshots } from "./snapshots";
import { seedScenarios } from "./scenarios";

export type SeedBroker = { broker: Broker; users: User[] };

/** Module demo data. */
export async function seedModules(prisma: PrismaClient, brokers: SeedBroker[]) {
  const summary: Record<string, unknown> = {};
  for (const [i, { broker, users }] of brokers.entries()) {
    summary[`moneyList:${broker.slug}`] = await seedMoneyList(prisma, broker, users, i === 0 ? 60 : 24, 17 + i * 31);
    summary[`snapshots:${broker.slug}`] = await seedSnapshots(prisma, broker, users);
    summary[`scenarios:${broker.slug}`] = await seedScenarios(prisma, broker, users);
  }
  return summary;
}
