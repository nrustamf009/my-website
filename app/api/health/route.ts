import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeDbUrl } from "@/lib/db/url";
import { demoLoginEnabled } from "@/lib/auth/demo";

export const dynamic = "force-dynamic";

/**
 * Deploy check: what database URL shape the server sees, which Prisma engine/provider it has,
 * and whether the database answers. Never returns the URL or any secret. Never throws.
 */
export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";
  const url = normalizeDbUrl(raw);
  const out: Record<string, unknown> = {
    demo: demoLoginEnabled(),
    databaseUrl: !raw ? "missing" : /^postgres(ql)?:\/\//.test(url) ? "postgres" : /^file:/.test(url) ? "sqlite-file" : "unrecognized",
    databaseUrlCleaned: raw.trim() !== url,
    bundledDemoDb: [process.cwd(), process.env.LAMBDA_TASK_ROOT, "/var/task"].some((r) => r && existsSync(join(r, "prisma", "demo.db"))),
  };
  try {
    const dir = join(process.cwd(), "node_modules", ".prisma", "client");
    if (existsSync(dir)) {
      out.engines = readdirSync(dir).filter((f) => f.includes("engine"));
      out.provider = readFileSync(join(dir, "schema.prisma"), "utf8").match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1] ?? "unknown";
    } else out.engines = "client dir not found";
  } catch (e) {
    out.engines = `unreadable: ${String((e as Error).message).slice(0, 120)}`;
  }
  try {
    const { prisma } = await import("@/lib/db");
    out.brokers = await prisma.broker.count();
    out.db = "ok";
  } catch (e) {
    out.db = "error";
    out.error = String((e as Error)?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "postgres://***").split("\n").map((l) => l.trim()).filter(Boolean).slice(-3).join(" ").slice(0, 400);
  }
  return NextResponse.json(out, { status: 200 });
}
