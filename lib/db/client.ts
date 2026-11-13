import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Base client. Use it directly ONLY for non-tenant models (Agency, User, Broker, auth tables,
 * caches) and inside lib/db/system.ts. Tenant data must go through forBroker() (lib/db/scoped.ts).
 * A guard test fails the build if app code touches tenant models on this client.
 */
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
