/** Runtime twin of scripts/db-url.mjs: tolerate a pasted psql snippet, quotes and channel_binding. */
export function normalizeDbUrl(raw: string | undefined): string {
  let u = String(raw ?? "").trim();
  u = u.replace(/^DATABASE_URL\s*=\s*/i, "").replace(/^psql\s+/i, "").trim();
  u = u.replace(/^['"]|['"]$/g, "").trim();
  const m = u.match(/postgres(?:ql)?:\/\/\S+/);
  if (m) u = m[0].replace(/['"]+$/, "");
  u = u.replace(/([?&])channel_binding=[^&]*&?/, "$1").replace(/[?&]$/, "");
  return u;
}
