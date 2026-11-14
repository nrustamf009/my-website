// Netlify scheduled function: calls /api/cron/agency-rollup with the cron secret. Schedule lives in netlify.toml.
export default async () => {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/cron/agency-rollup`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  console.log("cron agency-rollup", res.status);
  return new Response(null, { status: res.ok ? 200 : 502 });
};
