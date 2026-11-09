// One-time local setup: create .env, create the SQLite database, load demo data.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

if (!existsSync(".env")) {
  const env = readFileSync(".env.example", "utf8").replace("change-me-to-a-long-random-string", randomBytes(32).toString("base64"));
  writeFileSync(".env", env);
  console.log("Created .env from .env.example");
}
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npx prisma db push --skip-generate");
run("npx prisma generate");
run("npx tsx prisma/seed.ts");
console.log("\nReady. Run `npm run dev` and open http://localhost:3000/login");
