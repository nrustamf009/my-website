// Netlify scheduled function: calls /api/cron/money-list-digest with the cron secret. Schedule lives in netlify.toml.
export default async () => {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/cron/money-list-digest`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  console.log("cron money-list-digest", res.status);
  return new Response(null, { status: res.ok ? 200 : 502 });
};
