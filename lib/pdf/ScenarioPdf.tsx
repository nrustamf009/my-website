import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { PublicBrand } from "@/lib/broker";
import type { ComputedOption } from "@/lib/scenarios";
import { dscr, pct, points, rate, shortDate, usd, usdMagnitude } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { C, PdfFooter, PdfHeader, registerFonts, s } from "./common";

export interface ScenarioPdfProps {
  brand: PublicBrand;
  investorName: string;
  address: string;
  mode: "PURCHASE" | "RATE_TERM" | "CASH_OUT";
  valueCents: number;
  rentCents: number;
  rows: ComputedOption[];
  note: string | null;
  createdAt: Date;
  expiresAt: Date;
}

function Doc(p: ScenarioPdfProps) {
  const { brand, rows } = p;
  const lines: [string, (r: ComputedOption) => string, boolean?][] = [
    ["Product", (r) => t.productShort[r.input.product]],
    ["Loan amount", (r) => `${usd(r.input.loanAmountCents)} (${pct(r.result.ltvRatio)} LTV)`],
    ["Rate", (r) => rate(r.input.rateMilli), true],
    ["Points / credit", (r) => (r.input.pointsRatio === 0 ? "None" : `${points(r.input.pointsRatio)} (${usdMagnitude(r.result.pointsCents)})`)],
    ["Lender fees", (r) => usd(r.input.feesCents)],
    ["Prepayment penalty", (r) => t.prepay[r.input.prepay]],
    ["Monthly payment (PITIA)", (r) => usd(r.result.pitiaCents), true],
    ["After interest-only period", (r) => (r.result.postIoPitiaCents ? usd(r.result.postIoPitiaCents) : "—")],
    ["DSCR", (r) => dscr(r.result.dscrRatio), true],
    ["Cash flow / month", (r) => usd(r.result.cashFlowCents)],
    [p.mode === "PURCHASE" ? "Cash to close (est.)" : "Cash to you / to close", (r) => (r.result.cashToBorrowerCents ? `+${usd(r.result.cashToBorrowerCents)}` : usd(r.result.cashToCloseCents)), true],
    ["5-year cost (payments + points + fees)", (r) => usd(r.result.fiveYearCostCents)],
  ];
  return (
    <Document title={`Loan options – ${p.address}`} author={brand.companyName}>
      <Page size="LETTER" style={s.page}>
        <PdfHeader brand={brand} eyebrow={t.scenario.eyebrow(p.investorName)} title={p.address} subtitle={`${t.mode[p.mode]} · ${p.mode === "PURCHASE" ? "Price" : "Value"} ${usd(p.valueCents)} · Rent ${usd(p.rentCents)}/mo · ${t.scenario.pricingAsOf(shortDate(p.createdAt), shortDate(p.expiresAt))}`} />
        <View style={[s.row, { borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 4 }]}>
          <Text style={{ flex: 1.5 }} />
          {rows.map((r) => (
            <Text key={r.option.id} style={{ flex: 1, textAlign: "right", fontWeight: 700, color: r.option.recommended ? brand.accentText : C.ink }}>
              Option {r.option.label}{r.option.recommended ? " (recommended)" : ""}
            </Text>
          ))}
        </View>
        {lines.map(([label, fn, strong]) => (
          <View key={label} style={s.tableRow}>
            <Text style={{ flex: 1.5, color: C.ink2 }}>{label}</Text>
            {rows.map((r) => <Text key={r.option.id} style={{ flex: 1, textAlign: "right", fontWeight: strong ? 700 : 400 }}>{fn(r)}</Text>)}
          </View>
        ))}
        {rows.some((r) => r.vsFirst?.breakevenMonths) && (
          <Text style={[s.small, { marginTop: 6 }]}>
            {rows.filter((r) => r.vsFirst?.breakevenMonths).map((r) => `Option ${r.option.label} costs ${usd(r.vsFirst!.extraUpfrontCents)} more upfront and saves ${usd(r.vsFirst!.monthlySavingsCents)}/mo vs Option A: breakeven in about ${r.vsFirst!.breakevenMonths} months.`).join(" ")}
          </Text>
        )}

        <View style={{ marginTop: 14 }} wrap={false}>
          <Text style={s.h2}>If you sell or refinance early: prepayment penalty by year</Text>
          <View style={[s.row, { gap: 10 }]}>
            {rows.map((r) => (
              <View key={r.option.id} style={[s.card, { flex: 1, padding: 8 }]}>
                <Text style={{ fontWeight: 700, marginBottom: 3 }}>Option {r.option.label}</Text>
                {r.result.prepaySchedule.length === 0 ? (
                  <Text style={s.muted}>No penalty</Text>
                ) : (
                  r.result.prepaySchedule.map((y) => (
                    <View key={y.year} style={[s.row, { justifyContent: "space-between" }]}>
                      <Text style={s.muted}>Year {y.year} ({pct(y.penaltyRatio)})</Text>
                      <Text>{usd(y.penaltyCents)}</Text>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>
        </View>
        {p.note ? (
          <View style={[s.card, { marginTop: 12, backgroundColor: C.paper, borderColor: C.paper }]} wrap={false}>
            <Text style={{ fontWeight: 600 }}>A note from {brand.lo.name.split(" ")[0]}</Text>
            <Text style={s.muted}>{p.note}</Text>
          </View>
        ) : null}
        <PdfFooter brand={brand} extra="Payments include estimated taxes and insurance. Rates change daily and are confirmed when you lock." />
      </Page>
    </Document>
  );
}

export async function renderScenarioPdf(p: ScenarioPdfProps) {
  registerFonts();
  return renderToBuffer(<Doc {...p} />);
}
