/**
 * Accepts the connection string the way people paste it: Neon's "psql 'postgresql://…'" snippet,
 * surrounding quotes or spaces, a "DATABASE_URL=" prefix. Drops `channel_binding`, which Prisma's
 * engine does not support. Mirrors lib/db/url.ts (used at runtime).
 */
export function normalizeDbUrl(raw) {
  let u = String(raw ?? "").trim();
  u = u.replace(/^DATABASE_URL\s*=\s*/i, "").replace(/^psql\s+/i, "").trim();
  u = u.replace(/^['"]|['"]$/g, "").trim();
  const m = u.match(/postgres(?:ql)?:\/\/\S+/);
  if (m) u = m[0].replace(/['"]+$/, "");
  u = u.replace(/([?&])channel_binding=[^&]*&?/, "$1").replace(/[?&]$/, "");
  return u;
}

/**
 * Hosted build without a usable Postgres URL (Netlify, or BUNDLED_SQLITE=true): ship a pre-seeded
 * SQLite file with the app instead (prisma/demo.db); lib/db/client.ts copies it to /tmp at runtime.
 */
export function useBundledSqlite(url) {
  const hosted = process.env.NETLIFY === "true" || process.env.BUNDLED_SQLITE === "true";
  return hosted && !/^postgres(ql)?:\/\//.test(url);
}
export const BUNDLED_DB_URL = "file:./demo.db"; // relative to prisma/schema.prisma
