// Hosted demo: when SEED_IF_EMPTY=true and the Postgres database has no brokers yet,
// load the demo data once. Never wipes an existing database. Locally (SQLite) it does nothing.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (process.env.SEED_IF_EMPTY === "true" && /^postgres(ql)?:\/\//.test(url)) {
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
