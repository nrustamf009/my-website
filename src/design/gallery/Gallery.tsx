"use client";

import { useState } from "react";
import type { DealAnalysis, ScenarioOptionResult } from "@/lib/dscr";
import { dscr, pct, points, rate, usd, usdMagnitude, usdSigned } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { THEMES, type ThemeId } from "../index";
import { ThemeScope } from "../ThemeScope";
import { BrokerFooter } from "../components/BrokerFooter";
import { CtaButton, DataRow, Eyebrow, Metric, Panel, SectionTitle } from "../components/primitives";
import { ResultHero } from "../variants/ResultHero";
import { ImprovementList } from "../variants/ImprovementList";
import { OptionCompare, type CompareOption } from "../variants/OptionCompare";
import { fixtureBrand, FIXTURE_ADDRESS } from "./fixture";

export interface GalleryData {
  a: DealAnalysis;
  min: number;
  strong: number;
  options: { label: string; recommended: boolean; product: string; rateMilli: number; pointsRatio: number; prepay: string; result: ScenarioOptionResult }[];
}

/** /dev/design: every key surface in every theme from the golden fixture (numbers from lib/dscr). */
export function Gallery({ data, only }: { data: GalleryData; only: ThemeId | null }) {
  const ids = only ? [only] : (Object.keys(THEMES) as ThemeId[]);
  return (
    <div className={only ? "" : "grid gap-0 xl:grid-cols-3"}>
      {ids.map((id) => (
        <ThemeScope key={id} theme={id} accent={THEMES[id].defaultAccent} fill={false} className="min-h-full border-r border-rule">
          <div className="mx-auto max-w-[var(--gallery-width,26rem)] px-[var(--space-page)] py-8" data-testid={`gallery-${id}`}>
            <Eyebrow>{THEMES[id].name} · Instant Check</Eyebrow>
            <CheckSurface data={data} />
            <div className="mt-12"><Eyebrow>{THEMES[id].name} · Scenario Sheet</Eyebrow></div>
            <ScenarioSurface data={data} />
          </div>
          <BrokerFooter brand={fixtureBrand(id, THEMES[id].defaultAccent)} />
        </ThemeScope>
      ))}
    </div>
  );
}

function CheckSurface({ data }: { data: GalleryData }) {
  const { a } = data;
  return (
    <div className="mt-3 space-y-8">
      <ResultHero address={FIXTURE_ADDRESS} value={a.dscrRatio} verdict={a.verdict} min={data.min} strong={data.strong} explanation={t.verdictHelp[a.verdict]} />
      <section>
        <SectionTitle n="01">The numbers</SectionTitle>
        <DataRow label="Estimated rent" hint="Likely range $2,780 to $3,120. The lender uses the appraiser's figure." value={usd(a.qualifyingRentCents)} />
        <DataRow label="Monthly payment" hint={`Principal and interest ${usd(a.piCents)} · taxes ${usd(a.taxesMonthlyCents)} · insurance ${usd(a.insuranceMonthlyCents)} · HOA ${usd(a.hoaMonthlyCents)}`} value={usd(a.pitiaCents)} />
        <DataRow label="Monthly cash flow" hint="Rent less the full payment, before repairs and vacancy." value={usdSigned(a.cashFlowCents)} tone="accent" />
      </section>
      <section>
        <SectionTitle n="02">Ways to reach {dscr(data.strong)}</SectionTitle>
        <div className="mt-3">
          <ImprovementList
            stretchLabel={t.stretch}
            items={a.whatToChange.slice(0, 3).map((w) => ({
              delta: w.lever === "RENT" ? `+${usd(w.delta)}` : w.lever === "PRICE" ? `−${usdMagnitude(w.delta)}` : `+${usd(w.cashCostCents)}`,
              unit: w.lever === "RENT" ? "/mo" : undefined,
              label: w.lever === "RENT" ? `Rent at ${usd(w.to)} a month` : t.lever[w.lever](usd(w.to)),
              hint: w.lever === "DOWN_PAYMENT" ? t.leverNote.DOWN_PAYMENT(usd(w.cashCostCents)) : t.leverNote.RENT(),
            }))}
          />
        </div>
      </section>
      <Panel>
        <Eyebrow>What this property supports</Eyebrow>
        <Metric label="Maximum loan" value={usd(a.maxLoanCents)} hint={`${pct(a.ltvRatio)} of price at FICO 740+`} />
        <Metric label="Cash to close" value={usd(a.cashToCloseCents)} hint="Down payment, costs and prepaids" />
        <Metric label="Reserves to show" value={usd(a.reservesCents)} hint="Six months of payments" />
      </Panel>
      <CtaButton type="button">Email me the full analysis</CtaButton>
    </div>
  );
}

function ScenarioSurface({ data }: { data: GalleryData }) {
  const [open, setOpen] = useState<string | null>(null);
  const opts: CompareOption[] = data.options.map((o) => ({
    id: o.label,
    label: o.label,
    tag: o.label === "A" ? "No points" : o.label === "B" ? "Highest cash flow" : "Lowest rate",
    recommended: o.recommended,
    rateMilli: o.rateMilli,
    productLong: t.product[o.product as "FIXED30"],
    productShort: t.productShort[o.product as "FIXED30"],
    pitiaCents: o.result.pitiaCents,
    dscrRatio: o.result.dscrRatio,
    cashFlowCents: o.result.cashFlowCents,
    pointsLabel: o.pointsRatio ? points(o.pointsRatio) : "0",
    pointsCostCents: Math.max(0, o.result.pointsCents),
    prepayShort: o.prepay,
    postIoPitiaCents: o.result.postIoPitiaCents,
    note: t.prepayExplainer[o.prepay as "3-2-1"],
  }));
  return (
    <div className="mt-3">
      <OptionCompare
        options={opts}
        picked={null}
        min={data.min}
        strong={data.strong}
        open={open}
        onToggle={(id) => setOpen(open === id ? null : id)}
        details={(o) => <p className="text-sm">Rate {rate(o.rateMilli)} · payment {usd(o.pitiaCents)}</p>}
        action={(o, emphasis) => <button type="button" className={emphasis === "primary" ? "cta w-full bg-accent text-on-accent" : "min-h-14 w-full border border-current px-5 text-left font-semibold"}>{t.scenario.interested(o.label)}</button>}
      />
    </div>
  );
}
