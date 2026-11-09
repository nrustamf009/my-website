import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { PublicBroker } from "@/lib/broker";
import { analyzeDeal, VERDICT_LABEL, type BrokerDefaults, type DealAnalysis, type DealInput } from "@/lib/dscr";
import { pct, rate, ratio, usd } from "@/lib/format";
import { C, Kv, PdfBrandHeader, PdfFooter, s } from "./common";

const verdictColors = {
  LIKELY: { bg: C.goodSoft, fg: C.good },
  BORDERLINE: { bg: C.warnSoft, fg: C.warn },
  UNLIKELY: { bg: C.badSoft, fg: C.bad },
};

function DealAnalysisDoc({ broker, address, investorName, a, sensitivity }: { broker: PublicBroker; address: string; investorName: string; a: DealAnalysis; sensitivity: DealAnalysis[] }) {
  const vc = verdictColors[a.verdict];
  return (
    <Document title={`DSCR analysis – ${address}`} author={broker.companyName}>
      <Page size="LETTER" style={s.page}>
        <PdfBrandHeader broker={broker} title="DSCR Deal Analysis" subtitle={`${address} · Prepared for ${investorName} · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`} />

        <View style={[s.row, { gap: 10, marginBottom: 14 }]}>
          <View style={[s.card, { flex: 1, backgroundColor: vc.bg, borderColor: vc.bg }]}>
            <Text style={{ fontSize: 8, color: vc.fg, textTransform: "uppercase", letterSpacing: 1 }}>Estimated DSCR</Text>
            <Text style={{ fontSize: 30, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: vc.fg, marginTop: 2 }}>{ratio(a.dscr)}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", color: vc.fg }}>{VERDICT_LABEL[a.verdict]}</Text>
            <Text style={{ fontSize: 8, color: vc.fg, marginTop: 2 }}>Program minimum used: {a.minDscr.toFixed(2)}</Text>
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Monthly payment (PITIA)</Text>
            <Text style={{ fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{usd(a.pitia)}</Text>
            <Text style={s.muted}>Rent {usd(a.monthlyRent)}/mo · cash flow {usd(a.monthlyRent - a.pitia)}/mo</Text>
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Max loan estimate</Text>
            <Text style={{ fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{usd(a.maxLoan)}</Text>
            <Text style={s.muted}>Limited by {a.maxLoanLimitedBy === "DSCR" ? "rental income (DSCR)" : `max LTV ${pct(a.maxLtv)}`}</Text>
          </View>
        </View>

        <View style={[s.row, { gap: 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Deal</Text>
            <Kv label="Purchase price" value={usd(a.price)} />
            <Kv label={`Down payment (${pct(a.downPaymentPct)})`} value={usd(a.downPayment)} />
            <Kv label={`Loan amount (LTV ${pct(a.ltv)})`} value={usd(a.loanAmount)} />
            <Kv label="Estimated rate" value={`${rate(a.ratePct)} · ${a.termYears}-yr${a.interestOnly ? " interest-only" : ""}`} />
            <Kv label="Monthly rent" value={usd(a.monthlyRent)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Monthly payment breakdown</Text>
            <Kv label={a.interestOnly ? "Interest" : "Principal & interest"} value={usd(a.pi, { cents: true })} />
            <Kv label="Property taxes" value={usd(a.escrow.taxesMonthly, { cents: true })} />
            <Kv label="Insurance" value={usd(a.escrow.insuranceMonthly, { cents: true })} />
            <Kv label="HOA" value={usd(a.escrow.hoaMonthly, { cents: true })} />
            <Kv label="Total PITIA" value={usd(a.pitia, { cents: true })} strong />
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={s.h2}>{a.suggestions.length ? "What to change to qualify" : "Why this deal looks good"}</Text>
          {a.suggestions.length ? (
            a.suggestions.map((sg, i) => (
              <View key={i} style={[s.row, { marginBottom: 5 }]}>
                <Text style={{ width: 14, color: broker.accentColor, fontFamily: "Helvetica-Bold" }}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{sg.title}</Text>
                  <Text style={s.muted}>{sg.detail}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={s.muted}>Rent covers the estimated payment at least {a.minDscr.toFixed(2)}x, and the loan amount is within typical limits for your credit range. Rent needed for DSCR {a.minDscr.toFixed(2)}: {usd(a.rentForMinDscr)}/mo.</Text>
          )}
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={s.h2}>How down payment changes the numbers</Text>
          <View style={[s.tableRow, { borderBottomColor: C.ink }]}>
            {["Down payment", "Loan", "PITIA", "DSCR", "Verdict"].map((h) => (
              <Text key={h} style={{ flex: 1, fontSize: 8, color: C.muted, textTransform: "uppercase" }}>{h}</Text>
            ))}
          </View>
          {sensitivity.map((r) => (
            <View key={r.downPaymentPct} style={s.tableRow}>
              <Text style={{ flex: 1 }}>{pct(r.downPaymentPct)}</Text>
              <Text style={{ flex: 1 }}>{usd(r.loanAmount)}</Text>
              <Text style={{ flex: 1 }}>{usd(r.pitia)}</Text>
              <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>{ratio(r.dscr)}</Text>
              <Text style={{ flex: 1, color: verdictColors[r.verdict].fg }}>{VERDICT_LABEL[r.verdict]}</Text>
            </View>
          ))}
        </View>

        <View style={[s.card, { marginTop: 18, backgroundColor: C.paper, borderColor: C.paper }]}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Next step: a 15-minute call with {broker.name.split(" ")[0]}</Text>
          <Text style={s.muted}>
            We'll confirm the rent, taxes and insurance, check current pricing across DSCR lenders, and tell you exactly what it takes to close. {broker.phone ? `Call or text ${broker.phone}` : `Email ${broker.email}`}.
          </Text>
        </View>

        <PdfFooter broker={broker} extra="Taxes and insurance are estimated from a percentage of price unless provided. This analysis is an estimate, not an offer to lend." />
      </Page>
    </Document>
  );
}

export async function renderDealAnalysisPdf(params: { broker: PublicBroker; defaults: BrokerDefaults; input: DealInput; address: string; investorName: string }): Promise<Buffer> {
  const a = analyzeDeal(params.input, params.defaults);
  const downs = Array.from(new Set([0.2, 0.25, 0.3, params.input.downPaymentPct])).sort((x, y) => x - y);
  const sensitivity = downs.map((d) => analyzeDeal({ ...params.input, downPaymentPct: d }, params.defaults));
  return renderToBuffer(<DealAnalysisDoc broker={params.broker} address={params.address} investorName={params.investorName} a={a} sensitivity={sensitivity} />);
}
