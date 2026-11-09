import { env } from "@/lib/env";
import { sendEmailSafe } from "@/lib/providers/email";
import { esc } from "@/lib/providers/email/templates";

/** Welcome email sent when the agency adds a broker login. */
export async function sendBrokerInvite(params: { to: string; name: string | null; agencyName: string; companyName: string; slug: string }) {
  const login = `${env.appUrl}/login`;
  const page = `${env.appUrl}/b/${params.slug}/check`;
  const first = (params.name ?? "").split(" ")[0] || "there";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px"><tr><td style="padding:28px">
<h1 style="margin:0 0 10px;font-size:22px;color:#17150f">Your DSCR Investor Toolkit is ready</h1>
<p style="color:#3d3a33;font-size:15px;line-height:1.55">Hi ${esc(first)}, ${esc(params.agencyName)} set up the toolkit for ${esc(params.companyName)}. You now have a branded DSCR calculator for investors, scenario sheets that tell you when clients open them, listing snapshots for your realtor partners, and a Money List of past clients worth a call.</p>
<p style="margin:22px 0"><a href="${login}" style="background:#17150f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p>
<p style="color:#3d3a33;font-size:14px;line-height:1.55"><strong>First 10 minutes:</strong><br>1. Sign in with this email address (we'll send you a one-time link, no password).<br>2. Open Settings: upload your logo, check your NMLS and disclaimer.<br>3. Share your Instant Check page: <a href="${page}" style="color:#17150f">${esc(page.replace(/^https?:\/\//, ""))}</a></p>
<p style="color:#6f6a60;font-size:12px;margin-top:24px">You received this because ${esc(params.agencyName)} created an account for ${esc(params.to)}.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `Hi ${first}, ${params.agencyName} set up the DSCR Investor Toolkit for ${params.companyName}.\n\nSign in: ${login}\nYour Instant Check page: ${page}\n\nFirst steps: sign in with this email, open Settings to add your logo and check your NMLS and disclaimer, then share your Instant Check page.`;
  return sendEmailSafe({ to: params.to, subject: `${params.agencyName} set up your DSCR Investor Toolkit`, html, text }, "broker.invite");
}
