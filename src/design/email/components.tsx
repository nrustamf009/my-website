import { Body, Button, Column, Container, Font, Head, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import type { PublicBrand } from "@/lib/broker";
import { t } from "@/lib/strings/en";
import { getEmailTheme, platformEmailTheme, type EmailTheme } from "./theme";

export interface Row2 {
  label: string;
  value: string;
}

function Shell({ th, preview, children }: { th: EmailTheme; preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content={th.dark ? "dark light" : "light"} />
        <meta name="supported-color-schemes" content={th.dark ? "dark light" : "light"} />
        {th.googleFonts && <link rel="stylesheet" href={th.googleFonts} />}
        <Font fontFamily={th.font.body.split(",")[0]!.replace(/'/g, "")} fallbackFontFamily="Helvetica" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: th.color.canvas, color: th.color.ink, fontFamily: th.font.body }}>
        <Container style={{ maxWidth: 600, margin: "24px auto", backgroundColor: th.color.card, borderRadius: th.radius.card, overflow: "hidden", border: `1px solid ${th.color.rule}` }}>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

/** Investor and broker emails: logo row, optional hero figure, intro, key figures, one CTA, broker footer. */
export function BrandEmail({
  brand,
  preview,
  heading,
  intro,
  hero,
  rows,
  children,
  cta,
  footerNote,
  internal = false,
}: {
  brand: PublicBrand;
  preview: string;
  heading: string;
  intro?: string;
  hero?: { label: string; value: string; note?: string };
  rows?: Row2[];
  children?: ReactNode;
  cta?: { label: string; url: string };
  footerNote?: string;
  internal?: boolean;
}) {
  const th = getEmailTheme(brand.theme, brand.accentColor);
  const k = th.color;
  return (
    <Shell th={th} preview={preview}>
      <Section style={{ height: 4, backgroundColor: k.accent }} />
      <Section style={{ padding: "24px 28px 8px" }}>
        {brand.logoUrl && /^https?:/.test(brand.logoUrl) ? (
          <Img src={brand.logoUrl} alt={brand.companyName} height={36} />
        ) : (
          <Text style={{ margin: 0, fontWeight: 700, color: k.ink, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase" }}>{brand.companyName}</Text>
        )}
        {hero && (
          <Section style={{ margin: "18px 0 6px" }}>
            <Text style={{ margin: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: k.muted }}>{hero.label}</Text>
            <Text style={{ margin: "2px 0 0", fontFamily: th.font.display, fontSize: 64, lineHeight: "64px", fontWeight: th.numeral.weight, color: k.ink }}>{hero.value}</Text>
            {hero.note && <Text style={{ margin: "6px 0 0", fontFamily: th.numeral.italic ? th.font.display : th.font.body, fontStyle: th.numeral.italic ? "italic" : "normal", fontSize: 20, color: k.accentText }}>{hero.note}</Text>}
          </Section>
        )}
        <Text style={{ fontFamily: th.font.display, fontSize: 24, lineHeight: "30px", fontWeight: th.numeral.weight >= 600 ? 700 : 400, color: k.ink, margin: "14px 0 6px" }}>{heading}</Text>
        {intro && <Text style={{ fontSize: 15, lineHeight: "23px", color: k.ink2, margin: 0 }}>{intro}</Text>}
        {rows && rows.length > 0 && (
          <Section style={{ margin: "16px 0", borderTop: `1px solid ${k.rule}` }}>
            {rows.map((r) => (
              <Row key={r.label} style={{ borderBottom: `1px solid ${k.rule}` }}>
                <Column style={{ padding: "10px 0", fontSize: 14, color: k.muted }}>{r.label}</Column>
                <Column style={{ padding: "10px 0", fontSize: 15, color: k.ink, fontWeight: 600, textAlign: "right" }}>{r.value}</Column>
              </Row>
            ))}
          </Section>
        )}
        {children}
        {cta && (
          <Section style={{ margin: "22px 0" }}>
            <Button href={cta.url} style={{ backgroundColor: k.accent, color: k.onAccent, padding: "14px 22px", borderRadius: th.radius.control, fontWeight: 600, fontSize: 15 }}>
              {cta.label}
            </Button>
          </Section>
        )}
      </Section>
      <Hr style={{ borderColor: k.rule, margin: 0 }} />
      <Section style={{ padding: "16px 28px 24px", backgroundColor: k.panel }}>
        <EmailBrokerFooter brand={brand} th={th} internal={internal} />
        {footerNote && <Text style={{ fontSize: 12, color: k.muted, margin: "10px 0 0" }}>{footerNote}</Text>}
      </Section>
    </Shell>
  );
}

export function EmailBullets({ brand, items }: { brand: PublicBrand; items: string[] }) {
  const th = getEmailTheme(brand.theme, brand.accentColor);
  return (
    <ul style={{ paddingLeft: 18, margin: "12px 0", color: th.color.ink2, fontSize: 14, lineHeight: "22px" }}>
      {items.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}

/** Email version of the BrokerFooter: LO + company NMLS, licensed states, NMLS Consumer Access, EHO, versioned disclaimer. */
export function EmailBrokerFooter({ brand, th, internal }: { brand: PublicBrand; th: EmailTheme; internal?: boolean }) {
  const k = th.color;
  const s = { fontSize: 12, lineHeight: "18px", color: k.muted, margin: 0 };
  return (
    <>
      <Text style={{ ...s, color: k.ink2 }}>
        <strong>{brand.lo.name}</strong>, {brand.lo.title}
        {brand.lo.nmlsId ? ` · NMLS #${brand.lo.nmlsId}` : ""} · {brand.companyName} · Company NMLS #{brand.companyNmlsId}
        {brand.lo.phone ? ` · ${brand.lo.phone}` : ""} · {brand.lo.email}
      </Text>
      <Text style={s}>
        {t.footer.eho}
        {brand.licensedStates.length ? ` · ${t.footer.licensedIn(brand.licensedStates.join(", "))}` : ""} ·{" "}
        <Link href={`https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/${brand.companyNmlsId}`} style={{ color: k.muted }}>
          {t.footer.nmlsConsumerAccess}
        </Link>
        {brand.privacyPolicyUrl ? (
          <>
            {" · "}
            <Link href={brand.privacyPolicyUrl} style={{ color: k.muted }}>{t.footer.privacy}</Link>
          </>
        ) : null}
      </Text>
      {!internal && (
        <Text style={{ ...s, marginTop: 8 }}>
          {brand.disclaimer.text} ({t.footer.disclaimerVersion(brand.disclaimer.version)})
        </Text>
      )}
    </>
  );
}

/** Product-branded email (magic links, invites, agency rollups) in the platform theme. */
export function PlatformEmail({ heading, paragraphs, cta }: { heading: string; paragraphs: string[]; cta?: { label: string; url: string } }) {
  const th = platformEmailTheme();
  const k = th.color;
  return (
    <Shell th={th} preview={heading}>
      <Section style={{ padding: 28 }}>
        <Text style={{ fontFamily: th.font.display, fontSize: 24, color: k.ink, margin: "0 0 10px" }}>{heading}</Text>
        {paragraphs.map((x) => (
          <Text key={x} style={{ color: k.ink2, fontSize: 15, lineHeight: "23px" }}>{x}</Text>
        ))}
        {cta && (
          <Section style={{ margin: "20px 0" }}>
            <Button href={cta.url} style={{ backgroundColor: k.ink, color: k.card, padding: "12px 20px", borderRadius: th.radius.control, fontWeight: 600 }}>{cta.label}</Button>
          </Section>
        )}
        <Text style={{ color: k.muted, fontSize: 12 }}>DSCR Investor Toolkit</Text>
      </Section>
    </Shell>
  );
}
