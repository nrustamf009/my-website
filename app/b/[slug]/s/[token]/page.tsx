import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pickPublic } from "@/lib/leads";
import { computeScenario, PREPAY_EXPLAINER, PURPOSE_LABEL } from "@/lib/scenarios";
import { COST_HORIZON_YEARS, PREPAY_LABEL, type PrepayType } from "@/lib/dscr";
import { pct, rate, ratio, shortDate, usd } from "@/lib/format";
import { PublicShell } from "@/components/public/PublicShell";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { ScenarioTracker } from "@/components/scenarios/ScenarioTracker";
import { PublicOptions, type OptionView } from "@/components/scenarios/PublicOptions";
import { buttonClass, Card, cx } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false }, title: { absolute: "Your loan options" } };

const GLOSSARY: [string, string][] = [
  ["DSCR", "Debt Service Coverage Ratio: monthly rent ÷ monthly payment. 1.00 means the rent exactly covers the payment; lenders usually want 1.00 or more."],
  ["PITIA", "Your full monthly payment: principal, interest, property taxes, insurance and HOA dues."],
  ["LTV", "Loan-to-value: the loan amount as a percentage of the price or value. Lower LTV usually means better pricing."],
  ["Points", "An optional upfront fee (1 point = 1% of the loan) paid to lower the interest rate."],
  ["Prepayment penalty", "A fee if you sell or refinance early. Accepting one usually lowers your rate."],
  ["Interest-only", "For the first years you pay only interest, which lowers the payment. Afterwards the payment rises to pay off the loan."],
];

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const s = await prisma.scenario.findFirst({ where: { token, broker: { slug, active: true }, status: { not: "ARCHIVED" } }, include: { broker: true, options: true } });
  if (!s) notFound();
  const broker = pickPublic(s.broker);
  const { rows, best, recommended } = computeScenario(s, s.broker.minDscr);
  const first = broker.name.split(" ")[0]!;
  const api = `/api/public/${slug}/s/${token}`;
  const purchase = s.loanPurpose === "PURCHASE";
  const cashLabel = purchase ? "Cash to close" : "Upfront costs";
  const recLabel = rows.find((r) => r.option.id === recommended)?.option.label;

  const views: OptionView[] = rows.map(({ option: o, result: r, vsBase, meetsMinDscr }) => {
    const tags = [
      best?.lowestPayment === o.id && "Lowest payment",
      best?.lowestCash === o.id && (purchase ? "Least cash to close" : "Lowest upfront cost"),
      best?.lowestFiveYear === o.id && `Lowest ${COST_HORIZON_YEARS}-yr cost`,
    ].filter(Boolean) as string[];
    let breakEven: string | null = null;
    if (vsBase?.breakEvenMonths) {
      const m = Math.ceil(vsBase.breakEvenMonths);
      breakEven = `vs Option ${vsBase.baseLabel}: ${usd(vsBase.extraUpfront)} more upfront, ${usd(vsBase.monthlySavings)}/mo lower payment. Pays for itself in about ${m} months (${(m / 12).toFixed(1)} years).`;
    } else if (vsBase && vsBase.extraUpfront > 0 && vsBase.monthlySavings <= 0) {
      breakEven = `vs Option ${vsBase.baseLabel}: ${usd(vsBase.extraUpfront)} more upfront with no payment savings.`;
    }
    return {
      id: o.id,
      label: o.label,
      headline: `${rate(o.ratePct)} · ${o.interestOnly ? `${o.ioYears}-yr interest-only` : `${o.termYears}-yr fixed`}`,
      tags,
      recommended: o.recommended,
      pitia: usd(r.pitia),
      dscr: ratio(r.dscr),
      meetsMin: meetsMinDscr,
      cashFlow: usd(r.monthlyCashFlow),
      cashFlowPositive: r.monthlyCashFlow >= 0,
      rows: [
        ["Loan amount", `${usd(o.loanAmount)} · ${pct(r.ltv)} LTV`],
        [o.interestOnly ? "Interest-only payment" : "Principal & interest", usd(r.pi)],
        ["Prepayment penalty", PREPAY_LABEL[o.prepay as PrepayType]],
        ["Points", o.pointsPct ? `${o.pointsPct}% · ${usd(r.pointsCost)}` : "None"],
        ["Lender fees", usd(o.lenderFees)],
        ...(purchase ? ([["Down payment", usd(r.downPayment)]] as [string, string][]) : []),
        [`Est. ${cashLabel.toLowerCase()}*`, usd(r.cashToClose)],
        [`${COST_HORIZON_YEARS}-year cost†`, usd(r.fiveYearCost)],
      ],
      prepayExplainer: PREPAY_EXPLAINER[o.prepay] ?? "",
      breakEven,
      postIo: r.postIoPITIA ? `After ${o.ioYears} years the payment becomes about ${usd(r.postIoPITIA)}/mo as principal payments begin.` : null,
    };
  });

  const compare: { label: string; key: keyof NonNullable<typeof best> | null; value: (i: number) => string }[] = [
    { label: "Monthly payment", key: "lowestPayment", value: (i) => usd(rows[i]!.result.pitia) },
    { label: "Rate", key: null, value: (i) => `${rate(rows[i]!.option.ratePct)}${rows[i]!.option.interestOnly ? " IO" : ""}` },
    { label: "DSCR", key: "highestDscr", value: (i) => ratio(rows[i]!.result.dscr) },
    { label: cashLabel, key: "lowestCash", value: (i) => usd(rows[i]!.result.cashToClose) },
    { label: `${COST_HORIZON_YEARS}-year cost`, key: "lowestFiveYear", value: (i) => usd(rows[i]!.result.fiveYearCost) },
    { label: "Prepay", key: null, value: (i) => (rows[i]!.option.prepay === "NONE" ? "None" : `${rows[i]!.option.prepay.split("-").length} yrs`) },
  ];

  return (
    <PublicShell broker={broker}>
      <ScenarioTracker endpoint={`${api}/view`} />
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Loan options for {s.investorName}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink sm:text-5xl">{s.propertyAddress}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            [PURPOSE_LABEL[s.loanPurpose], null],
            [purchase ? "Price" : "Value", usd(s.propertyValue)],
            ["Rent", `${usd(s.monthlyRent)}/mo`],
            ["Taxes", `${usd(s.taxesMonthly)}/mo`],
            ["Insurance", `${usd(s.insuranceMonthly)}/mo`],
            ...(s.hoaMonthly ? [["HOA", `${usd(s.hoaMonthly)}/mo`]] : []),
          ].map(([k, v]) => (
            <span key={k} className="rounded-full border border-line bg-white px-3 py-1 text-ink-2">
              {k}
              {v && <strong className="num ml-1 font-semibold text-ink">{v}</strong>}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Pricing as of {shortDate(s.updatedAt)}. Rates change daily and are confirmed when you lock.</p>

        {(s.note || recLabel) && (
          <div className="mt-6 flex max-w-3xl gap-3 rounded-2xl border border-line bg-white p-4">
            <BrokerAvatar broker={broker} size={40} />
            <div className="text-sm leading-relaxed text-ink-2">
              <div className="font-semibold text-ink">
                {broker.name}
                {recLabel && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">Recommends Option {recLabel}</span>}
              </div>
              {s.note && <p className="mt-1">{s.note}</p>}
            </div>
          </div>
        )}
      </section>

      {/* At a glance */}
      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <h2 className="mb-3 font-display text-2xl text-ink">At a glance</h2>
        <Card className="overflow-hidden">
          <table className="w-full table-fixed text-sm" data-testid="compare-table">
            <thead>
              <tr className="border-b border-line">
                <th className="w-[30%] px-3 py-3 sm:px-5" />
                {rows.map((r) => (
                  <th key={r.option.id} className={cx("px-2 py-3 text-right sm:px-5", r.option.recommended && "bg-accent-soft")}>
                    <div className="font-display text-lg text-ink sm:text-xl">{r.option.label}</div>
                    {r.option.recommended && <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-deep">{first}&apos;s pick</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {compare.map((c) => (
                <tr key={c.label}>
                  <td className="px-3 py-2.5 text-muted sm:px-5">{c.label}</td>
                  {rows.map((r, i) => {
                    const isBest = c.key && best?.[c.key] === r.option.id && rows.length > 1;
                    return (
                      <td key={r.option.id} className={cx("num px-1.5 py-2.5 text-right sm:px-5", r.option.recommended && "bg-accent-faint")}>
                        <span className={cx("inline-block whitespace-nowrap rounded-md", isBest ? "bg-good-soft px-1.5 py-0.5 font-semibold text-good" : "text-ink")} {...(isBest ? { "data-best": "true" } : {})}>
                          {c.value(i)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-muted"><span className="mr-1 rounded bg-good-soft px-1.5 py-0.5 font-semibold text-good">Green</span> = best value in each row.</p>
      </section>

      {/* Details */}
      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <h2 className="mb-3 font-display text-2xl text-ink">Option details</h2>
        <PublicOptions options={views} endpoint={`${api}/interest`} initialChosen={s.interestedOptionId} brokerFirstName={first} phone={broker.phone} minDscr={s.broker.minDscr.toFixed(2)} />
        <p className="mt-4 text-xs leading-relaxed text-muted">
          *Excludes title, escrow, appraisal, prepaid interest and reserves, which depend on the lender and state. †Monthly payments for {COST_HORIZON_YEARS} years plus points and lender fees (not the down payment).
          Payments include estimated taxes and insurance{s.hoaMonthly ? " and HOA" : ""}.
        </p>
      </section>

      {/* Next steps + glossary */}
      <section className="mx-auto mt-10 grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-xl text-ink">What happens next</h2>
          <ol className="mt-4 space-y-4">
            {[
              ["Pick an option", "Tap “I'm interested”. You can change your mind anytime."],
              [`${first} confirms pricing`, "Rates are re-checked across DSCR lenders, and you get a short document checklist. No tax returns needed."],
              ["Lock and close", "Lock your rate, order the appraisal and close, usually in 3–4 weeks."],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-3">
                <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">{i + 1}</span>
                <div><div className="font-semibold text-ink">{t}</div><div className="text-sm text-muted">{b}</div></div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={`/b/${slug}/s/${token}/pdf`} className={buttonClass("secondary", "md")} target="_blank">Download PDF</a>
            {broker.phone && <a href={`tel:${broker.phone.replace(/[^\d+]/g, "")}`} className={buttonClass("ghost", "md")}>Questions? Call {first}</a>}
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-xl text-ink">What these terms mean</h2>
          <div className="mt-3 divide-y divide-line">
            {GLOSSARY.map(([t, d]) => (
              <details key={t} className="group py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                  {t}
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
              </details>
            ))}
          </div>
        </Card>
      </section>
    </PublicShell>
  );
}
