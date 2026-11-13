import { env } from "@/lib/env";
import { sendPlatformEmail } from "@/lib/emails";

/** Welcome email when the agency adds a broker login. */
export async function sendBrokerInvite(p: { to: string; name: string | null; agencyName: string; companyName: string; slug: string }) {
  const first = (p.name ?? "").split(" ")[0] || "there";
  return sendPlatformEmail({
    to: p.to,
    subject: `${p.agencyName} set up your DSCR Investor Toolkit`,
    heading: "Your DSCR Investor Toolkit is ready",
    paragraphs: [
      `Hi ${first}, ${p.agencyName} set up the toolkit for ${p.companyName}: a branded DSCR calculator for your website, scenario sheets that tell you when investors open them, listing snapshots for realtor partners, and a Money List of past clients worth a call.`,
      "Sign in with this email address (we send a one-time link, no password). A 10-minute setup walks you through branding, licensing, program defaults and notifications.",
      `Your public calculator: ${env.appUrl.replace(/^https?:\/\//, "")}/b/${p.slug}/check`,
    ],
    cta: { label: "Sign in and finish setup", url: `${env.appUrl}/login` },
    tag: "broker.invite",
  });
}
