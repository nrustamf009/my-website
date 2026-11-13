import type { Broker, PrismaClient, User } from "@prisma/client";
import { seedMoneyList } from "./moneylist";

export type SeedBroker = { broker: Broker; users: User[] };

/** Module demo data. */
export async function seedModules(prisma: PrismaClient, brokers: SeedBroker[]) {
  const summary: Record<string, unknown> = {};
  for (const [i, { broker, users }] of brokers.entries()) {
    summary[`moneyList:${broker.slug}`] = await seedMoneyList(prisma, broker, users, i === 0 ? 60 : 24, 17 + i * 31);
  }
  return summary;
}
