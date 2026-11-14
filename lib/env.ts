/** Centralized environment access. Every optional integration falls back to a mock. */
const e = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

export const env = {
  get appUrl() {
    return (e("APP_URL") ?? e("URL") ?? (e("VERCEL_URL") ? `https://${e("VERCEL_URL")}` : "http://localhost:3000")).replace(/\/$/, "");
  },
  get authSecret() {
    return e("AUTH_SECRET") ?? "dev-insecure-secret-change-me";
  },
  get resendKey() {
    return e("RESEND_API_KEY");
  },
  get emailFrom() {
    return e("EMAIL_FROM") ?? "DSCR Toolkit <onboarding@resend.dev>";
  },
  get anthropicKey() {
    return e("ANTHROPIC_API_KEY");
  },
  get anthropicModel() {
    return e("ANTHROPIC_MODEL") ?? "claude-opus-5-5";
  },
  get rentcastKey() {
    return e("RENTCAST_API_KEY");
  },
  get transcribeKey() {
    return e("TRANSCRIBE_API_KEY");
  },
  get cronSecret() {
    return e("CRON_SECRET");
  },
};

export function providerModes() {
  return {
    email: env.resendKey ? "Resend" : "Dev mailbox (mock)",
    ai: env.anthropicKey ? `Claude (${env.anthropicModel})` : "Mock AI",
    rent: env.rentcastKey ? "RentCast" : "Mock estimates",
    bot: process.env.TURNSTILE_SECRET_KEY ? "Cloudflare Turnstile" : "Mock (no bot check)",
  };
}
