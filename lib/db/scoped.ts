import type { PrismaClient } from "@prisma/client";
import { prisma as basePrisma } from "./client";

/** Models that carry brokerId directly. */
export const TENANT_MODELS = new Set([
  "Lead",
  "Consent",
  "Event",
  "Scenario",
  "Realtor",
  "Snapshot",
  "LoanImport",
  "ClosedLoan",
  "SavedNote",
  "WebhookDelivery",
  "DisclaimerVersion",
]);

/** Child models scoped through their parent relation. */
const CHILD_SCOPE: Record<string, (brokerId: unknown) => Record<string, unknown>> = {
  ScenarioOption: (b) => ({ scenario: { brokerId: b } }),
  ScenarioView: (b) => ({ scenario: { brokerId: b } }),
  LoanStatusChange: (b) => ({ loan: { brokerId: b } }),
};

const WHERE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
  "upsert",
]);

type Scope = string | { in: string[] };

function scoped(scope: Scope, base: PrismaClient) {
  return base.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const a = (args ?? {}) as Record<string, any>;
          if (TENANT_MODELS.has(model)) {
            if (WHERE_OPS.has(operation)) a.where = { ...(a.where ?? {}), brokerId: scope };
            if (operation === "create" || operation === "upsert") {
              const key = operation === "create" ? "data" : "create";
              const d = a[key] ?? {};
              if (typeof scope !== "string") throw new Error(`Cannot create ${model} in a multi-broker scope`);
              if (d.brokerId && d.brokerId !== scope) throw new Error(`Cross-tenant write blocked on ${model}`);
              if (d.broker) throw new Error(`Use brokerId, not a broker relation, when creating ${model}`);
              a[key] = { ...d, brokerId: scope };
            }
            if (operation === "createMany") {
              if (typeof scope !== "string") throw new Error(`Cannot create ${model} in a multi-broker scope`);
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              for (const r of rows) if (r.brokerId && r.brokerId !== scope) throw new Error(`Cross-tenant write blocked on ${model}`);
              a.data = rows.map((r: Record<string, unknown>) => ({ ...r, brokerId: scope }));
            }
          } else if (CHILD_SCOPE[model]) {
            if (WHERE_OPS.has(operation)) a.where = { ...(a.where ?? {}), ...CHILD_SCOPE[model](scope) };
            if (operation === "create" || operation === "createMany") throw new Error(`Create ${model} through its parent (nested write)`);
          }
          return query(a);
        },
      },
    },
  });
}

/** The tenant-scoped client: every query on tenant models is filtered (and every create stamped) with brokerId. */
export function forBroker(brokerId: string, base: PrismaClient = basePrisma) {
  if (!brokerId) throw new Error("forBroker requires a brokerId");
  return Object.assign(scoped(brokerId, base), { brokerId });
}

/** Read-only cross-broker scope for agency stats (limited to the agency's own brokers). */
export function forBrokers(brokerIds: string[], base: PrismaClient = basePrisma) {
  return scoped({ in: brokerIds }, base);
}

export type ScopedDb = ReturnType<typeof forBroker>;
