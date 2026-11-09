import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { PublicBroker } from "@/lib/broker";
import { computeScenario, PURPOSE_LABEL, type ScenarioWithOptions } from "@/lib/scenarios";
import { COST_HORIZON_YEARS, PREPAY_LABEL, type PrepayType } from "@/lib/dscr";
import { pct, rate, ratio, shortDate, usd } from "@/lib/format";
import { C, PdfBrandHeader, PdfFooter, s } from "./common";

function ScenarioDoc({ broker, sc }: { broker: PublicBroker; sc: ScenarioWithOptions }) {
  const { rows } = computeScenario(sc);
  const purchase = sc.loanPurpose === "PURCHASE";
  const lines: [string, (r: (typeof rows)[number]) => string, boolean?][] = [
    ["Monthly payment (PITIA)", (r) => usd(r.result.pitia), true],
    ["DSCR", (r) => ratio(r.result.dscr), true],
    ["Monthly cash flow", (r) => usd(r.result.monthlyCashFlow)],
    ["Loan amount", (r) => `${usd(r.option.loanAmount)} (${pct(r.result.ltv)})`],
    ["Rate", (r) => rate(r.option.ratePct)],
    ["Structure", (r) => (r.option.interestOnly ? `${r.option.termYears}-yr, ${r.option.ioYears}-yr IO` : `${r.option.termYears}-yr fixed`)],
    ["Principal & interest", (r) => usd(r.result.pi)],
    ["Prepayment penalty", (r) => PREPAY_LABEL[r.option.prepay as PrepayType]],
    ["Points", (r) => `${r.option.pointsPct}% (${usd(r.result.pointsCost)})`],
    ["Lender fees", (r) => usd(r.option.lenderFees)],
    ...(purchase ? ([["Down payment", (r) => usd(r.result.downPayment)]] as [string, (r: (typeof rows)[number]) => string][]) : []),
    [purchase ? "Est. cash to close" : "Est. upfront costs", (r) => usd(r.result.cashToClose), true],
    [`${COST_HORIZON_YEARS}-year cost (payments + points/fees)`, (r) => usd(r.result.fiveYearCost)],
    ["Points break-even", (r) => (r.vsBase?.breakEvenMonths ? `~${Math.ceil(r.vsBase.breakEvenMonths)} months vs ${r.vsBase.baseLabel}` : "—")],
  ];
  return (
    <Document title={`Loan options – ${sc.propertyAddress}`} author={broker.companyName}>
      <Page size="LETTER" style={s.page}>
        <PdfBrandHeader broker={broker} title="Loan Options Comparison" subtitle={`${sc.propertyAddress} · ${PURPOSE_LABEL[sc.loanPurpose]} · Prepared for ${sc.investorName} · Pricing as of ${shortDate(sc.updatedAt)}`} />
        <View style={[s.row, { gap: 18, marginBottom: 14 }]}>
          <Text>{purchase ? "Price" : "Value"}: <Text style={{ fontFamily: "Helvetica-Bold" }}>{usd(sc.propertyValue)}</Text></Text>
          <Text>Rent: <Text style={{ fontFamily: "Helvetica-Bold" }}>{usd(sc.monthlyRent)}/mo</Text></Text>
          <Text>Taxes: <Text style={{ fontFamily: "Helvetica-Bold" }}>{usd(sc.taxesMonthly)}</Text></Text>
          <Text>Insurance: <Text style={{ fontFamily: "Helvetica-Bold" }}>{usd(sc.insuranceMonthly)}</Text></Text>
          {sc.hoaMonthly ? <Text>HOA: <Text style={{ fontFamily: "Helvetica-Bold" }}>{usd(sc.hoaMonthly)}</Text></Text> : null}
        </View>
        <View style={[s.tableRow, { borderBottomColor: C.ink, borderBottomWidth: 1.5 }]}>
          <Text style={{ flex: 1.4 }} />
          {rows.map((r) => (
            <View key={r.option.id} style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, lineHeight: 1.2, color: broker.accentColor }}>Option {r.option.label}</Text>
              {r.option.recommended ? <Text style={{ fontSize: 7, color: broker.accentColor }}>RECOMMENDED</Text> : null}
            </View>
          ))}
        </View>
        {lines.map(([label, f, strong]) => (
          <View key={label} style={s.tableRow}>
            <Text style={{ flex: 1.4, color: C.ink2 }}>{label}</Text>
            {rows.map((r) => <Text key={r.option.id} style={{ flex: 1, textAlign: "right", fontFamily: strong ? "Helvetica-Bold" : "Helvetica" }}>{f(r)}</Text>)}
          </View>
        ))}
        {sc.note ? (
          <View style={[s.card, { marginTop: 16, backgroundColor: C.paper, borderColor: C.paper }]}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Note from {broker.name.split(" ")[0]}</Text>
            <Text style={s.muted}>{sc.note}</Text>
          </View>
        ) : null}
        <Text style={[s.small, { marginTop: 12 }]}>Cash to close excludes title, escrow, appraisal, prepaid interest and reserves. DSCR = monthly rent ÷ PITIA.</Text>
        <PdfFooter broker={broker} extra="Rates and terms shown are illustrative and subject to lender approval and change without notice." />
      </Page>
    </Document>
  );
}

export function renderScenarioPdf(broker: PublicBroker, sc: ScenarioWithOptions) {
  return renderToBuffer(<ScenarioDoc broker={broker} sc={sc} />);
}
