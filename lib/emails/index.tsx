import { render } from "@react-email/components";
import type { PublicBrand } from "@/lib/broker";
import { BrandEmail, EmailBullets, PlatformEmail, type Row2 } from "@design/email/components";
import { sendEmailSafe } from "@/lib/providers/email";
import type { EmailAttachment } from "@/lib/providers/email/types";

export interface BrandEmailInput {
  brand: PublicBrand;
  to: string | string[];
  subject: string;
  heading: string;
  intro?: string;
  /** Big figure under the logo (investor analysis: DSCR). */
  hero?: { label: string; value: string; note?: string };
  rows?: Row2[];
  bullets?: string[];
  cta?: { label: string; url: string };
  footerNote?: string;
  internal?: boolean;
  replyTo?: string;
  fromName?: string;
  attachments?: EmailAttachment[];
  tag: string;
}

/** Render a branded React Email to HTML + plain text, then send (never throws). */
export async function sendBrandEmail(e: BrandEmailInput): Promise<boolean> {
  const element = (
    <BrandEmail brand={e.brand} preview={e.intro ?? e.heading} heading={e.heading} intro={e.intro} hero={e.hero} rows={e.rows} cta={e.cta} footerNote={e.footerNote} internal={e.internal}>
      {e.bullets?.length ? <EmailBullets brand={e.brand} items={e.bullets} /> : null}
    </BrandEmail>
  );
  const html = await render(element);
  const text = [
    e.heading,
    "",
    e.intro ?? "",
    ...(e.rows ?? []).map((r) => `${r.label}: ${r.value}`),
    ...(e.bullets ?? []).map((b) => `- ${b}`),
    e.cta ? `\n${e.cta.label}: ${e.cta.url}` : "",
    "",
    `${e.brand.lo.name}${e.brand.lo.nmlsId ? `, NMLS #${e.brand.lo.nmlsId}` : ""} · ${e.brand.companyName}, NMLS #${e.brand.companyNmlsId} · Equal Housing Opportunity`,
    e.internal ? "" : e.brand.disclaimer.text,
  ].join("\n");
  return sendEmailSafe({ to: e.to, subject: e.subject, html, text, replyTo: e.replyTo, fromName: e.fromName, attachments: e.attachments }, e.tag);
}

/** Plain product-branded email (invites, agency rollups) in the platform theme. */
export async function sendPlatformEmail(p: { to: string | string[]; subject: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string }; tag: string }) {
  const html = await render(<PlatformEmail heading={p.heading} paragraphs={p.paragraphs} cta={p.cta} />);
  const text = [p.heading, "", ...p.paragraphs, p.cta ? `${p.cta.label}: ${p.cta.url}` : ""].join("\n\n");
  return sendEmailSafe({ to: p.to, subject: p.subject, html, text }, p.tag);
}

export type { Row2 };
