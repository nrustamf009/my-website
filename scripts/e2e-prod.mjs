#!/usr/bin/env node
/**
 * Full Playwright run against a production build (what CI does):
 * reseed → next build (separate dist dir, so a running `next dev` is untouched) → next start → playwright → stop.
 * Extra args are passed to Playwright, e.g. `npm run test:e2e:prod -- --project=mobile`.
 */
import { spawn, execSync } from "node:child_process";

const PORT = process.env.E2E_PORT ?? "3100";
const env = { ...process.env, NEXT_DIST_DIR: ".next-prod", DEMO_LOGIN: "true", APP_URL: `http://localhost:${PORT}` };
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("npx prisma db push --skip-generate");
run("npx tsx prisma/seed.ts");
if (process.env.SKIP_BUILD !== "true") run("npm run build");

const server = spawn("npx", ["next", "start", "-p", PORT], { env, stdio: ["ignore", "inherit", "inherit"] });
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

const deadline = Date.now() + 90_000;
while (Date.now() < deadline) {
  try {
    const r = await fetch(`http://localhost:${PORT}/login`);
    if (r.ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 1000));
}

const pw = spawn("npx", ["playwright", "test", "--trace", "off", ...process.argv.slice(2)], { env: { ...env, E2E_BASE_URL: `http://localhost:${PORT}` }, stdio: "inherit" });
pw.on("exit", (code) => {
  stop();
  process.exit(code ?? 1);
});
