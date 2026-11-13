import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { PublicBrand } from "@/lib/broker";
import { listingSnapshot, type EngineContext, type ListingColumn, type ListingInput, type Verdict } from "@/lib/dscr";
import { dscr, pct, rate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { C, PdfFooter, PdfLogo, registerFonts, s } from "./common";

export interface SnapshotPdfProps {
  brand: PublicBrand;
  ctx: EngineContext;
  template: "CLASSIC" | "MODERN";
  address: string;
  listing: ListingInput;
  photoUrl: string | null;
  rentSource: string;
  realtor: { name: string; brokerage: string; phone: string | null; email: string | null; headshotUrl: string | null; logoUrl: string | null };
  url: string;
}

const VC: Record<Verdict, string> = { STRONG: C.good, BORDERLINE: C.warn, NEEDS_ADJUSTMENT: C.warn, NOT_ELIGIBLE: C.bad };
const isRaster = (u: string | null) => !!u && /^data:image\/(png|jpe?g);base64,|^https?:\/\/.+\.(png|jpe?g)(\?|$)/i.test(u);

function Table({ cols, accent, compact = false }: { cols: ListingColumn[]; accent: string; compact?: boolean }) {
  const rows: [string, (c: ListingColumn) => string, boolean?][] = [
    ["Down payment", (c) => `${usd(c.downPaymentCents)} (${pct(c.downRatio)})`],
    ["Loan amount", (c) => usd(c.loanAmountCents)],
    ["Principal & interest", (c) => usd(c.piCents)],
    ["Taxes + insurance", (c) => `${usd(c.taxesMonthlyCents)} + ${usd(c.insuranceMonthlyCents)}`],
    ["HOA", (c) => usd(c.hoaMonthlyCents)],
    ["Monthly payment (PITIA)", (c) => usd(c.pitiaCents), true],
    ["DSCR", (c) => dscr(c.dscrRatio), true],
    ["Cash flow / month", (c) => usd(c.cashFlowCents), true],
    ["Cash to close (est.)", (c) => usd(c.cashToCloseCents)],
    ["Rent for DSCR 1.00", (c) => usd(c.rentForDscr100Cents)],
    ["Rent for DSCR 1.20", (c) => usd(c.rentForDscr120Cents)],
  ];
  return (
    <View>
      <View style={[s.row, { borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 4 }]}>
        <Text style={{ flex: 1.3 }} />
        {cols.map((c) => (
          <Text key={c.downRatio} style={{ flex: 1, textAlign: "right", fontWeight: 700, color: accent }}>{pct(c.downRatio)} down</Text>
        ))}
      </View>
      {rows.filter(([label]) => !compact || !["Monthly payment (PITIA)", "DSCR", "Cash flow / month", "HOA"].includes(label)).map(([label, fn, strong]) => (
        <View key={label} style={[s.tableRow, compact ? { paddingVertical: 3 } : {}]}>
          <Text style={{ flex: 1.3, color: C.ink2 }}>{label}</Text>
          {cols.map((c) => (
            <Text key={c.downRatio} style={{ flex: 1, textAlign: "right", fontWeight: strong ? 700 : 400, color: label === "DSCR" ? VC[c.verdict] : label.startsWith("Cash flow") && c.cashFlowCents < 0 ? C.bad : C.ink }}>{fn(c)}</Text>
          ))}
        </View>
      ))}
      <View style={[s.row, { paddingTop: 4 }]}>
        <Text style={{ flex: 1.3, color: C.muted }}>Estimate</Text>
        {cols.map((c) => (
          <Text key={c.downRatio} style={{ flex: 1, textAlign: "right", fontWeight: 600, color: VC[c.verdict] }}>{t.verdict[c.verdict]}</Text>
        ))}
      </View>
    </View>
  );
}

function RealtorCard({ r, brand }: { r: SnapshotPdfProps["realtor"]; brand: PublicBrand }) {
  return (
    <View style={[s.row, { alignItems: "center", gap: 10 }]}>
      {isRaster(r.headshotUrl) ? <Image src={r.headshotUrl!} style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover" }} /> : <PdfLogo url={r.logoUrl} name={r.name} accent={C.ink2} size={40} round />}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 700 }}>{r.name}</Text>
        <Text style={s.small}>{r.brokerage}</Text>
        <Text style={s.small}>{[r.phone, r.email].filter(Boolean).join(" · ")}</Text>
      </View>
      <View style={{ width: 1, alignSelf: "stretch", backgroundColor: C.line, marginHorizontal: 4 }} />
      <PdfLogo url={brand.lo.headshotUrl ?? brand.logoUrl} name={brand.lo.name} accent={brand.accentColor} size={40} round={!!brand.lo.headshotUrl} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 700 }}>{brand.lo.name}</Text>
        <Text style={s.small}>{brand.companyName}{brand.lo.nmlsId ? ` · NMLS #${brand.lo.nmlsId}` : ""}</Text>
        <Text style={s.small}>{[brand.lo.phone, brand.lo.email].filter(Boolean).join(" · ")}</Text>
      </View>
    </View>
  );
}

function Qr({ dataUrl, accent }: { dataUrl: string; accent: string }) {
  return (
    <View style={{ alignItems: "center", width: 112 }}>
      <Image src={dataUrl} style={{ width: 96, height: 96 }} />
      <Text style={[s.small, { textAlign: "center", marginTop: 3, color: accent, fontWeight: 600 }]}>{t.listing.scan}</Text>
    </View>
  );
}

function SnapshotDoc(p: SnapshotPdfProps & { cols: ListingColumn[]; qr: string }) {
  const { brand, cols } = p;
  const rentNote = p.rentSource === "PROVIDER" ? "Market rent estimate" : "Rent provided by the listing agent";
  const assumptions = t.listing.assumptions("740+", t.productShort[p.listing.product ?? "FIXED30"]);
  const footerExtra = `${t.listing.respa(brand.companyName, p.realtor.brokerage)} ${assumptions}`;

  if (p.template === "MODERN") {
    return (
      <Document title={`Investor snapshot – ${p.address}`} author={brand.companyName}>
        <Page size="LETTER" style={[s.page, { padding: 0, paddingBottom: 110 }]}>
          <View style={{ height: isRaster(p.photoUrl) ? 200 : 118, backgroundColor: brand.accentColor }}>
            {isRaster(p.photoUrl) ? <Image src={p.photoUrl!} style={{ width: "100%", height: 200, objectFit: "cover" }} /> : null}
            <View style={{ position: "absolute", left: 28, bottom: 18, right: 28, backgroundColor: "#ffffff", borderRadius: 6, padding: 12 }}>
              <Text style={[s.eyebrow, { color: brand.accentText }]}>{t.listing.eyebrow}</Text>
              <Text style={[s.display, { fontSize: 20, marginTop: 2 }]}>{p.address}</Text>
              <Text style={s.muted}>List price {usd(p.listing.listPriceCents)} · {rentNote} {usd(p.listing.rentCents)}/mo · Rate {rate(cols[0]!.rateMilli)}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 28, paddingTop: 16 }}>
            <View style={[s.row, { gap: 10, marginBottom: 14 }]}>
              {cols.map((c) => (
                <View key={c.downRatio} style={[s.card, { flex: 1, borderColor: brand.accentColor }]}>
                  <Text style={[s.eyebrow, { color: brand.accentText }]}>{pct(c.downRatio)} down</Text>
                  <Text style={{ fontFamily: "Fraunces", fontSize: 24, lineHeight: 1.15, color: VC[c.verdict] }}>DSCR {dscr(c.dscrRatio)}</Text>
                  <Text style={{ fontWeight: 600 }}>{usd(c.pitiaCents)}/mo · cash flow {usd(c.cashFlowCents)}</Text>
                  <Text style={s.small}>Cash to close about {usd(c.cashToCloseCents)}</Text>
                </View>
              ))}
              <Qr dataUrl={p.qr} accent={brand.accentText} />
            </View>
            <Table cols={cols} accent={brand.accentText} compact />
            <View style={[s.card, { marginTop: 12 }]} wrap={false}>
              <RealtorCard r={p.realtor} brand={brand} />
            </View>
          </View>
          <PdfFooter brand={brand} extra={footerExtra} />
        </Page>
      </Document>
    );
  }

  return (
    <Document title={`Investor snapshot – ${p.address}`} author={brand.companyName}>
      <Page size="LETTER" style={s.page}>
        <View style={{ height: 5, backgroundColor: brand.accentColor, marginHorizontal: -36, marginTop: -36, marginBottom: 18 }} />
        <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[s.eyebrow, { color: brand.accentText }]}>{t.listing.eyebrow}</Text>
            <Text style={[s.display, { marginTop: 3 }]}>{p.address}</Text>
            <Text style={[s.muted, { marginTop: 3 }]}>List price {usd(p.listing.listPriceCents)} · {rentNote} {usd(p.listing.rentCents)}/mo · Rate {rate(cols[0]!.rateMilli)}</Text>
          </View>
          <Qr dataUrl={p.qr} accent={brand.accentText} />
        </View>
        {isRaster(p.photoUrl) ? <Image src={p.photoUrl!} style={{ height: 170, objectFit: "cover", borderRadius: 6, marginTop: 10 }} /> : null}
        <View style={{ marginTop: 14 }}>
          <Text style={s.h2}>Financing this property with a DSCR loan</Text>
          <Text style={[s.muted, { marginBottom: 8 }]}>DSCR loans qualify on the property&apos;s rent, not the investor&apos;s personal income. DSCR = rent ÷ monthly payment.</Text>
          <Table cols={cols} accent={brand.accentText} />
        </View>
        <View style={[s.card, { marginTop: 16, backgroundColor: C.paper, borderColor: C.paper }]}>
          <RealtorCard r={p.realtor} brand={brand} />
        </View>
        <PdfFooter brand={brand} extra={footerExtra} />
      </Page>
    </Document>
  );
}

export async function renderSnapshotPdf(p: SnapshotPdfProps): Promise<Buffer> {
  registerFonts();
  const cols = listingSnapshot(p.listing, p.ctx);
  const qr = await QRCode.toDataURL(p.url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#17150f", light: "#ffffff" } });
  return renderToBuffer(<SnapshotDoc {...p} cols={cols} qr={qr} />);
}
