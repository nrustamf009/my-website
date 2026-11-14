// Hosted demo: when the Postgres database has no brokers yet (unless SEED_IF_EMPTY=false),
// load the demo data once. Never wipes an existing database. Locally (SQLite) it does nothing.
import { execSync } from "node:child_process";
import { BUNDLED_DB_URL, normalizeDbUrl, useBundledSqlite } from "./db-url.mjs";
import { PrismaClient } from "@prisma/client";

const url = normalizeDbUrl(process.env.DATABASE_URL);
if (url) process.env.DATABASE_URL = url; // child processes (db push, seed) get the cleaned URL
if (process.env.SEED_IF_EMPTY !== "false" && /^postgres(ql)?:\/\//.test(url)) {
  const prisma = new PrismaClient();
  const brokers = await prisma.broker.count();
  await prisma.$disconnect();
  if (brokers === 0) {
    console.log("Empty database: loading demo data");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  } else {
    console.log(`Database has ${brokers} brokers: skipping demo seed`);
  }
}
if (useBundledSqlite(url)) {
  console.log("Seeding the bundled demo database");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, DATABASE_URL: BUNDLED_DB_URL } });
}
