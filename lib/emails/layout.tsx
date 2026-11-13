import { Body, Button, Column, Container, Head, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import type { PublicBrand } from "@/lib/broker";
import { t } from "@/lib/strings/en";

/** Same type system as web/PDF: serif display (Fraunces → Georgia fallback) + Inter/system sans. */
const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";

export interface Row2 {
  label: string;
  value: string;
}

export function BrandEmail({
  brand,
  preview,
  heading,
  intro,
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
  rows?: Row2[];
  children?: ReactNode;
  cta?: { label: string; url: string };
  footerNote?: string;
  /** Internal emails to the broker skip the investor disclaimer block. */
  internal?: boolean;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, background: "#f5f3ee", fontFamily: SANS }}>
        <Container style={{ maxWidth: 600, margin: "24px auto", background: "#ffffff", borderRadius: 14, overflow: "hidden" }}>
          <Section style={{ height: 6, background: brand.accentColor }} />
          <Section style={{ padding: "24px 28px 8px" }}>
            {brand.logoUrl && /^https?:/.test(brand.logoUrl) ? (
              <Img src={brand.logoUrl} alt={brand.companyName} height={36} />
            ) : (
              <Text style={{ margin: 0, fontWeight: 700, color: brand.accentText, fontSize: 16 }}>{brand.companyName}</Text>
            )}
            <Text style={{ fontFamily: SERIF, fontSize: 24, lineHeight: "30px", color: "#17150f", margin: "14px 0 6px" }}>{heading}</Text>
            {intro && <Text style={{ fontSize: 15, lineHeight: "23px", color: "#3d3a33", margin: 0 }}>{intro}</Text>}
            {rows && rows.length > 0 && (
              <Section style={{ margin: "16px 0", border: "1px solid #e6e2d9", borderRadius: 10 }}>
                {rows.map((r, i) => (
                  <Row key={r.label} style={{ background: i % 2 ? "#faf8f3" : "#ffffff" }}>
                    <Column style={{ padding: "9px 14px", fontSize: 14, color: "#6f6a60" }}>{r.label}</Column>
                    <Column style={{ padding: "9px 14px", fontSize: 14, color: "#17150f", fontWeight: 600, textAlign: "right" }}>{r.value}</Column>
                  </Row>
                ))}
              </Section>
            )}
            {children}
            {cta && (
              <Section style={{ margin: "22px 0" }}>
                <Button href={cta.url} style={{ background: brand.accentColor, color: brand.onAccent, padding: "12px 20px", borderRadius: 8, fontWeight: 600, fontSize: 15 }}>
                  {cta.label}
                </Button>
              </Section>
            )}
          </Section>
          <Hr style={{ borderColor: "#e6e2d9", margin: 0 }} />
          <Section style={{ padding: "16px 28px 24px" }}>
            <EmailFooter brand={brand} internal={internal} />
            {footerNote && <Text style={{ fontSize: 12, color: "#6f6a60", margin: "10px 0 0" }}>{footerNote}</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Email version of the BrokerFooter: LO + company NMLS, EHO, licensed states, versioned disclaimer. */
export function EmailFooter({ brand, internal }: { brand: PublicBrand; internal?: boolean }) {
  const s = { fontSize: 12, lineHeight: "18px", color: "#6f6a60", margin: 0 };
  return (
    <>
      <Text style={{ ...s, color: "#3d3a33" }}>
        <strong>{brand.lo.name}</strong>, {brand.lo.title}
        {brand.lo.nmlsId ? ` · NMLS #${brand.lo.nmlsId}` : ""} · {brand.companyName} · Company NMLS #{brand.companyNmlsId}
        {brand.lo.phone ? ` · ${brand.lo.phone}` : ""} · {brand.lo.email}
      </Text>
      <Text style={s}>
        {t.footer.eho}
        {brand.licensedStates.length ? ` · ${t.footer.licensedIn(brand.licensedStates.join(", "))}` : ""} ·{" "}
        <Link href={`https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/${brand.companyNmlsId}`} style={{ color: "#6f6a60" }}>
          {t.footer.nmlsConsumerAccess}
        </Link>
        {brand.privacyPolicyUrl ? (
          <>
            {" · "}
            <Link href={brand.privacyPolicyUrl} style={{ color: "#6f6a60" }}>{t.footer.privacy}</Link>
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
