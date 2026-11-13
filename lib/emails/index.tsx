import { render, Text } from "@react-email/components";
import type { PublicBrand } from "@/lib/broker";
import { BrandEmail, type Row2 } from "./layout";
import { sendEmailSafe } from "@/lib/providers/email";
import type { EmailAttachment } from "@/lib/providers/email/types";

export interface BrandEmailInput {
  brand: PublicBrand;
  to: string | string[];
  subject: string;
  heading: string;
  intro?: string;
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
    <BrandEmail brand={e.brand} preview={e.intro ?? e.heading} heading={e.heading} intro={e.intro} rows={e.rows} cta={e.cta} footerNote={e.footerNote} internal={e.internal}>
      {e.bullets?.length ? (
        <ul style={{ paddingLeft: 18, margin: "12px 0", color: "#3d3a33", fontSize: 14, lineHeight: "22px" }}>
          {e.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
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

/** Plain product-branded email (magic links, invites, agency rollups). */
export async function sendPlatformEmail(p: { to: string | string[]; subject: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string }; tag: string }) {
  const { Body, Button, Container, Head, Html, Section } = await import("@react-email/components");
  const html = await render(
    <Html lang="en">
      <Head />
      <Body style={{ background: "#f5f3ee", fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "24px auto", background: "#fff", borderRadius: 14, padding: 28 }}>
          <Text style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, color: "#17150f", margin: "0 0 10px" }}>{p.heading}</Text>
          {p.paragraphs.map((x) => (
            <Text key={x} style={{ color: "#3d3a33", fontSize: 15, lineHeight: "23px" }}>{x}</Text>
          ))}
          {p.cta && (
            <Section style={{ margin: "20px 0" }}>
              <Button href={p.cta.url} style={{ background: "#17150f", color: "#fff", padding: "12px 20px", borderRadius: 8, fontWeight: 600 }}>{p.cta.label}</Button>
            </Section>
          )}
          <Text style={{ color: "#6f6a60", fontSize: 12 }}>DSCR Investor Toolkit</Text>
        </Container>
      </Body>
    </Html>,
  );
  const text = [p.heading, "", ...p.paragraphs, p.cta ? `${p.cta.label}: ${p.cta.url}` : ""].join("\n\n");
  return sendEmailSafe({ to: p.to, subject: p.subject, html, text }, p.tag);
}

export type { Row2 };
