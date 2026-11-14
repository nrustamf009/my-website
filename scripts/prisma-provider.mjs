// Switches the Prisma datasource to Postgres when DATABASE_URL is a Postgres URL (e.g. on Vercel),
// and syncs the schema. Locally (SQLite) it does nothing.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { BUNDLED_DB_URL, normalizeDbUrl, useBundledSqlite } from "./db-url.mjs";

const url = normalizeDbUrl(process.env.DATABASE_URL);
if (url) process.env.DATABASE_URL = url; // child processes (db push, seed) get the cleaned URL
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
if (useBundledSqlite(url)) {
  console.log("No Postgres DATABASE_URL: building the bundled demo SQLite database (prisma/demo.db)");
  rmSync("prisma/demo.db", { force: true });
  execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: { ...process.env, DATABASE_URL: BUNDLED_DB_URL } });
}
