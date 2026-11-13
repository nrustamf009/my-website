import { prisma } from "./client";

/**
 * Cross-tenant access for system jobs only (cron sweeps over all brokers, webhook retries,
 * seed, agency rollups that already restrict by agency). Keep usage here minimal and audited.
 */
export const systemDb = prisma;
