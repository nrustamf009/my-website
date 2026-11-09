// Switches the Prisma datasource to Postgres when DATABASE_URL is a Postgres URL (e.g. on Vercel),
// and syncs the schema. Locally (SQLite) it does nothing.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const isPg = /^postgres(ql)?:\/\//.test(url);
const path = "prisma/schema.prisma";
const schema = readFileSync(path, "utf8");
if (isPg && schema.includes('provider = "sqlite"')) {
  writeFileSync(path, schema.replace('provider = "sqlite"', 'provider = "postgresql"'));
  console.log("Prisma: using PostgreSQL");
}
if (isPg && process.env.SKIP_DB_PUSH !== "true") {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
}
