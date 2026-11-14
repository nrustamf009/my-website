import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { normalizeDbUrl } from "./url";

const g = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Base client. Use it directly ONLY for non-tenant models (Agency, User, Broker, auth tables,
 * caches) and inside lib/db/system.ts. Tenant data must go through forBroker() (lib/db/scoped.ts).
 * A guard test fails the build if app code touches tenant models on this client.
 */
/**
 * Hosted demo without a database: use the pre-seeded SQLite file built into the deploy
 * (scripts/prisma-provider.mjs), copied to /tmp because the function's own files are read-only.
 * Each server instance keeps its own copy, which is fine for a demo.
 */
function bundledDemoUrl(): string | null {
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT, "/var/task"].filter(Boolean) as string[];
  const src = roots.map((r) => join(r, "prisma", "demo.db")).find((p) => existsSync(p));
  if (!src) return null;
  const dst = join("/tmp", "dscr-demo.db");
  if (!existsSync(dst)) copyFileSync(src, dst);
  return `file:${dst}`;
}

function resolveUrl(): string {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (/^(postgres(ql)?:\/\/|file:)/.test(url)) return url;
  return bundledDemoUrl() ?? url;
}

const url = resolveUrl();
// Pass the URL only when it was cleaned or replaced: a relative SQLite path in DATABASE_URL must keep
// resolving against prisma/ (schema dir), which only the env() route does.
const override = url && url !== (process.env.DATABASE_URL ?? "") ? { datasourceUrl: url } : undefined;
export const prisma = g.prisma ?? new PrismaClient(override);
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
