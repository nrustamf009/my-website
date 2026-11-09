import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Realtor, Snapshot } from "@prisma/client";
import type { PublicBroker } from "@/lib/broker";
import { listingSnapshotNumbers } from "@/lib/dscr";
import { pct, rate, ratio, usd } from "@/lib/format";
import { C, PdfFooter, PdfLogo, s } from "./common";

type Nums = ReturnType<typeof listingSnapshotNumbers>;

function Col({ title, n, accent }: { title: string; n: Nums["twenty"]; accent: string }) {
  const row = (k: string, v: string, strong = false) => (
    <View style={[s.tableRow, { paddingVertical: 6 }]}>
      <Text style={{ flex: 1, color: C.ink2 }}>{k}</Text>
      <Text style={{ fontFamily: strong ? "Helvetica-Bold" : "Helvetica" }}>{v}</Text>
    </View>
  );
  return (
    <View style={[s.card, { flex: 1 }]}>
      <Text style={{ fontSize: 9, color: accent, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1 }}>{title}</Text>
      <Text style={{ fontSize: 26, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginTop: 4 }}>{ratio(n.dscr)}</Text>
      <Text style={[s.muted, { marginBottom: 8 }]}>Estimated DSCR</Text>
      {row("Down payment", usd(n.downPayment))}
      {row("Loan amount", usd(n.loanAmount))}
      {row("Principal & interest", usd(n.pi))}
      {row("Total payment (PITIA)", usd(n.pitia), true)}
      {row("Rent for DSCR 1.00", `${usd(n.rentForDscr1)}/mo`)}
      {row("Rent for DSCR 1.20", `${usd(n.rentForDscr12)}/mo`)}
    </View>
  );
}

function SnapshotDoc({ broker, realtor, snap, nums, qr, url }: { broker: PublicBroker; realtor: Realtor; snap: Snapshot; nums: Nums; qr: string; url: string }) {
  return (
    <Document title={`Investor Financing Snapshot – ${snap.address}`} author={broker.companyName}>
      <Page size="LETTER" style={s.page}>
        <View style={{ height: 5, backgroundColor: broker.accentColor, marginHorizontal: -36, marginTop: -36, marginBottom: 20 }} />
        <View style={[s.row, { justifyContent: "space-between", alignItems: "center" }]}>
          <View style={[s.row, { alignItems: "center" }]}>
            <PdfLogo logoUrl={broker.logoUrl} name={broker.companyName} accent={broker.accentColor} size={34} />
            <View style={{ marginLeft: 8 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{broker.companyName}</Text>
              <Text style={s.small}>{broker.name} · NMLS #{broker.nmlsId}</Text>
            </View>
          </View>
          <Text style={{ color: C.muted, fontSize: 9 }}>in partnership with</Text>
          <View style={[s.row, { alignItems: "center" }]}>
            <View style={{ marginRight: 8, alignItems: "flex-end" }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{realtor.name}</Text>
              <Text style={s.small}>{realtor.brokerage}</Text>
            </View>
            <PdfLogo logoUrl={realtor.logoUrl} name={realtor.brokerage} accent={C.ink2} size={34} />
          </View>
        </View>

        <View style={{ marginTop: 22, marginBottom: 14 }}>
          <Text style={{ fontSize: 9, color: broker.accentColor, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5 }}>Investor Financing Snapshot</Text>
          <Text style={{ fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginTop: 4 }}>{snap.address}</Text>
          <View style={[s.row, { gap: 18, marginTop: 6 }]}>
            <Text>List price <Text style={{ fontFamily: "Helvetica-Bold" }}>{usd(snap.price)}</Text></Text>
            <Text>Est. rent <Text style={{ fontFamily: "Helvetica-Bold" }}>{usd(snap.monthlyRent)}/mo</Text></Text>
            <Text>Rate used <Text style={{ fontFamily: "Helvetica-Bold" }}>{rate(snap.ratePct)}</Text> (30-yr)</Text>
          </View>
        </View>

        <View style={[s.row, { gap: 12 }]}>
          <Col title="20% down" n={nums.twenty} accent={broker.accentColor} />
          <Col title="25% down" n={nums.twentyFive} accent={broker.accentColor} />
        </View>

        <Text style={[s.small, { marginTop: 8 }]}>
          Payment includes estimated taxes {usd(snap.taxesMonthly)}/mo, insurance {usd(snap.insuranceMonthly)}/mo{snap.hoaMonthly ? `, HOA ${usd(snap.hoaMonthly)}/mo` : ""}. DSCR = rent ÷ PITIA. LTV {pct(0.8)} and {pct(0.75)}.
        </Text>

        <View style={[s.row, s.card, { marginTop: 16, alignItems: "center", backgroundColor: C.paper, borderColor: C.paper }]}>
          <Image src={qr} style={{ width: 96, height: 96 }} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 14, lineHeight: 1.2, fontFamily: "Helvetica-Bold" }}>Scan to get pre-qualified for this property</Text>
            <Text style={[s.muted, { marginTop: 3 }]}>See live numbers, adjust the down payment and request a pre-qualification from {broker.name.split(" ")[0]}. No tax returns needed: DSCR loans qualify on the property's rent.</Text>
            <Text style={[s.small, { marginTop: 4 }]}>{url.replace(/\?.*$/, "")}</Text>
          </View>
        </View>

        <View style={[s.row, { marginTop: 14, gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{broker.name}, {broker.title}</Text>
            <Text style={s.muted}>{broker.companyName} · NMLS #{broker.nmlsId}</Text>
            <Text style={s.muted}>{[broker.phone, broker.email].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{realtor.name}</Text>
            <Text style={s.muted}>{realtor.brokerage}</Text>
            <Text style={s.muted}>{[realtor.phone, realtor.email].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>

        <PdfFooter broker={broker} extra={`Rent shown is an estimate${snap.rentSource === "MANUAL" ? " provided by the listing agent" : ""}. The listing agent is not a lender.`} />
      </Page>
    </Document>
  );
}

export async function renderListingSnapshotPdf(params: { broker: PublicBroker; realtor: Realtor; snapshot: Snapshot; url: string }) {
  const { snapshot: snap } = params;
  const nums = listingSnapshotNumbers({
    price: snap.price,
    monthlyRent: snap.monthlyRent,
    ratePct: snap.ratePct,
    escrow: { taxesMonthly: snap.taxesMonthly, insuranceMonthly: snap.insuranceMonthly, hoaMonthly: snap.hoaMonthly },
  });
  const qr = await QRCode.toDataURL(params.url, { margin: 1, width: 360, color: { dark: "#17150f", light: "#ffffff" } });
  return renderToBuffer(<SnapshotDoc broker={params.broker} realtor={params.realtor} snap={snap} nums={nums} qr={qr} url={params.url} />);
}
