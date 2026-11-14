// Netlify scheduled function: calls /api/cron/webhooks with the cron secret. Schedule lives in netlify.toml.
export default async () => {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/cron/webhooks`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  console.log("cron webhooks", res.status);
  return new Response(null, { status: res.ok ? 200 : 502 });
};
