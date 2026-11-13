import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { PublicBrand } from "@/lib/broker";
import { analyzeDeal, type DealAnalysis, type DealInput, type EngineContext, type Verdict } from "@/lib/dscr";
import { dscr, pct, points, rate, shortDate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { Kv, PdfFooter, PdfHeader, withPdfTheme, registerFonts, usePdf } from "./common";

type Pal = ReturnType<typeof usePdf>["C"];
const vcOf = (C: Pal): Record<Verdict, { bg: string; fg: string }> => ({
  STRONG: { bg: C.goodSoft, fg: C.good },
  BORDERLINE: { bg: C.warnSoft, fg: C.warn },
  NEEDS_ADJUSTMENT: { bg: C.warnSoft, fg: C.warn },
  NOT_ELIGIBLE: { bg: C.badSoft, fg: C.bad },
});

export function leverText(w: DealAnalysis["whatToChange"][number]) {
  const to = w.lever === "BUYDOWN" ? points(w.to) : usd(w.to);
  return { title: t.lever[w.lever](w.lever === "DOWN_PAYMENT" ? usd(w.to) : to), note: t.leverNote[w.lever](usd(w.cashCostCents)) };
}

function EstimateDoc({ brand, address, investor, a, compare }: { brand: PublicBrand; address: string; investor: string; a: DealAnalysis; compare: DealAnalysis[] }) {
  const { C, s } = usePdf();
  const VC = vcOf(C);
  const vc = VC[a.verdict];
  const purchase = a.mode === "PURCHASE";
  return (
    <Document title={`DSCR estimate – ${address}`} author={brand.companyName}>
      <Page size="LETTER" style={s.page}>
        <PdfHeader brand={brand} eyebrow="DSCR estimate" title={address} subtitle={`${t.mode[a.mode]} · Prepared for ${investor} · ${shortDate(new Date())}`} />

        <View style={[s.row, { gap: 8, marginBottom: 12 }]}>
          <View style={[s.card, { flex: 1.1, backgroundColor: vc.bg, borderColor: vc.bg }]}>
            <Text style={[s.eyebrow, { color: vc.fg }]}>Estimated DSCR</Text>
            <Text style={[s.numeral, { fontSize: 28, color: vc.fg, lineHeight: 1.15 }]}>{dscr(a.dscrRatio)}</Text>
            <Text style={{ fontWeight: 700, color: vc.fg }}>{t.verdict[a.verdict]}</Text>
            <Text style={{ fontSize: 7.5, color: vc.fg, marginTop: 2 }}>{t.verdictHelp[a.verdict]}</Text>
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <Text style={[s.eyebrow, s.muted]}>Estimated payment (PITIA)</Text>
            <Text style={{ fontSize: 18, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>{usd(a.pitiaCents)}/mo</Text>
            <Text style={s.muted}>Rent {usd(a.qualifyingRentCents)} · cash flow {usd(a.cashFlowCents)}/mo</Text>
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <Text style={[s.eyebrow, s.muted]}>{purchase ? "Total cash needed" : "Cash to you"}</Text>
            <Text style={{ fontSize: 18, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>{purchase ? usd(a.totalCashNeededCents) : usd(a.cashToBorrowerCents)}</Text>
            <Text style={s.muted}>{purchase ? `Closing ${usd(a.cashToCloseCents)} + reserves ${usd(a.reservesCents)}` : `Reserves needed ${usd(a.reservesCents)}`}</Text>
          </View>
        </View>

        <View style={[s.row, { gap: 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Deal</Text>
            <Kv label={purchase ? "Purchase price" : "Estimated value"} value={usd(a.valueCents)} />
            {purchase && <Kv label={`Down payment (${pct(a.downPaymentRatio)})`} value={usd(a.downPaymentCents)} />}
            <Kv label={`Loan amount (LTV ${pct(a.ltvRatio)})`} value={usd(a.loanAmountCents)} />
            <Kv label="Estimated rate" value={rate(a.rateMilli)} />
            <Kv label="Product" value={t.productShort[a.product]} />
            <Kv label="Prepayment penalty" value={t.prepay[a.prepay]} />
            <Kv label="Max loan under program defaults" value={usd(a.maxLoanCents)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Monthly payment</Text>
            <Kv label={a.postIoPiCents ? "Interest-only payment" : "Principal & interest"} value={usd(a.piCents, { cents: true })} />
            <Kv label={`Property taxes${a.taxSource === "STATE_DEFAULT" ? " (est.)" : ""}`} value={usd(a.taxesMonthlyCents, { cents: true })} />
            <Kv label={`Insurance${a.insuranceSource === "STATE_DEFAULT" ? " (est.)" : ""}`} value={usd(a.insuranceMonthlyCents, { cents: true })} />
            <Kv label="HOA" value={usd(a.hoaMonthlyCents, { cents: true })} />
            <Kv label="Total PITIA" value={usd(a.pitiaCents, { cents: true })} strong />
            {a.postIoPitiaCents ? <Kv label="After the interest-only period" value={usd(a.postIoPitiaCents, { cents: true })} /> : null}
            {purchase && (
              <>
                <Kv label="Closing costs (est.)" value={usd(a.closingCostsCents)} />
                <Kv label="Prepaids & escrow (est.)" value={usd(a.prepaidsCents)} />
              </>
            )}
          </View>
        </View>

        <View style={{ marginTop: 12 }} wrap={false}>
          <Text style={s.h2}>{a.whatToChange.length ? "What would change the outcome" : "Why it looks this way"}</Text>
          {a.whatToChange.slice(0, 4).map((w, i) => {
            const x = leverText(w);
            return (
              <View key={i} style={[s.row, { marginBottom: 4 }]}>
                <Text style={{ width: 14, color: C.accentText, fontWeight: 700 }}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 600 }}>{x.title} → {t.verdict[w.reaches]}</Text>
                  <Text style={s.muted}>{x.note}</Text>
                </View>
              </View>
            );
          })}
          {a.reasons.map((r) => (
            <Text key={r} style={[s.muted, { marginTop: 2 }]}>• {t.reason[r]}</Text>
          ))}
          {!a.whatToChange.length && !a.reasons.length && <Text style={s.muted}>{t.verdictHelp[a.verdict]}</Text>}
        </View>

        {compare.length > 0 && (
          <View style={{ marginTop: 12 }} wrap={false}>
            <Text style={s.h2}>How the down payment changes things</Text>
            <View style={[s.tableRow, { borderBottomColor: C.ink }]}>
              {["Down", "Loan", "PITIA", "DSCR", "Cash flow", "Estimate"].map((h) => (
                <Text key={h} style={{ flex: 1, fontSize: 7, color: C.muted, textTransform: "uppercase" }}>{h}</Text>
              ))}
            </View>
            {compare.map((r) => (
              <View key={r.downPaymentCents} style={s.tableRow}>
                <Text style={{ flex: 1 }}>{pct(r.downPaymentRatio)}</Text>
                <Text style={{ flex: 1 }}>{usd(r.loanAmountCents)}</Text>
                <Text style={{ flex: 1 }}>{usd(r.pitiaCents)}</Text>
                <Text style={{ flex: 1, fontWeight: 600 }}>{dscr(r.dscrRatio)}</Text>
                <Text style={{ flex: 1 }}>{usd(r.cashFlowCents)}</Text>
                <Text style={{ flex: 1, color: VC[r.verdict].fg }}>{t.verdict[r.verdict]}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[s.card, { marginTop: 14, backgroundColor: C.paper, borderColor: C.paper }]} wrap={false}>
          <Text style={{ fontWeight: 700 }}>Next step: a 15-minute call with {brand.lo.name.split(" ")[0]}</Text>
          <Text style={s.muted}>We&apos;ll confirm rent, taxes and insurance, compare DSCR programs, and outline exactly what it takes to close. {brand.lo.phone ? `Call or text ${brand.lo.phone}` : `Email ${brand.lo.email}`}.</Text>
        </View>

        <PdfFooter brand={brand} extra="Lenders use the appraiser's rent schedule; rent, taxes and insurance shown are estimates." />
      </Page>
    </Document>
  );
}

export async function renderEstimatePdf(p: { brand: PublicBrand; ctx: EngineContext; input: DealInput; address: string; investor: string }): Promise<Buffer> {
  registerFonts();
  const a = analyzeDeal(p.input, p.ctx);
  const compare =
    p.input.mode === "PURCHASE"
      ? Array.from(new Set([2_000, 2_500, 3_000, p.input.downPaymentRatio ?? 2_500]))
          .sort((x, y) => x - y)
          .map((d) => analyzeDeal({ ...p.input, downPaymentCents: undefined, downPaymentRatio: d }, p.ctx, { solve: false }))
      : [];
  return withPdfTheme(p.brand.theme, p.brand.accentColor, () => renderToBuffer(<EstimateDoc brand={p.brand} address={p.address} investor={p.investor} a={a} compare={compare} />));
}
