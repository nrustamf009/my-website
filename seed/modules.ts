import type { Broker, PrismaClient, User } from "@prisma/client";

export type SeedBroker = { broker: Broker; users: User[] };

/** Module demo data (filled in as modules are built). */
export async function seedModules(_prisma: PrismaClient, _brokers: SeedBroker[]) {
  return {};
}
