import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { pickPublic } from "@/lib/leads";
import { computeScenario, PURPOSE_LABEL } from "@/lib/scenarios";
import { PREPAY_LABEL, type PrepayType } from "@/lib/dscr";
import { pct, rate, ratio, usd } from "@/lib/format";
import { PublicShell } from "@/components/public/PublicShell";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";
import { ScenarioTracker } from "@/components/scenarios/ScenarioTracker";
import { InterestButton } from "@/components/scenarios/InterestButton";
import { Badge, buttonClass, Card, cx } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false }, title: { absolute: "Your loan options" } };

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const s = await prisma.scenario.findFirst({ where: { token, broker: { slug, active: true }, status: { not: "ARCHIVED" } }, include: { broker: true, options: true } });
  if (!s) notFound();
  const broker = pickPublic(s.broker);
  const { rows, best } = computeScenario(s);
  const first = broker.name.split(" ")[0]!;
  const api = `/api/public/${slug}/s/${token}`;
  const purchase = s.loanPurpose === "PURCHASE";

  return (
    <PublicShell broker={broker}>
      <ScenarioTracker endpoint={`${api}/view`} />
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Loan options · prepared for {s.investorName}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink sm:text-5xl">{s.propertyAddress}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
          <span>{PURPOSE_LABEL[s.loanPurpose]}</span>
          <span>{purchase ? "Price" : "Value"} <strong className="num text-ink">{usd(s.propertyValue)}</strong></span>
          <span>Rent <strong className="num text-ink">{usd(s.monthlyRent)}/mo</strong></span>
          <span>Taxes + insurance <strong className="num text-ink">{usd(s.taxesMonthly)} + {usd(s.insuranceMonthly)}/mo</strong></span>
        </div>
        {s.note && (
          <div className="mt-6 flex max-w-3xl gap-3 rounded-2xl border border-line bg-white p-4">
            <BrokerAvatar broker={broker} size={36} />
            <p className="text-sm leading-relaxed text-ink-2"><span className="font-semibold text-ink">{first}:</span> {s.note}</p>
          </div>
        )}
      </section>

      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className={cx("-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0", rows.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {rows.map(({ option: o, result: r }) => {
            const tags = [best?.lowestPayment === o.id && "Lowest payment", best?.highestDscr === o.id && "Highest DSCR", best?.lowestCash === o.id && (purchase ? "Least cash to close" : "Lowest upfront cost")].filter(Boolean) as string[];
            const chosen = s.interestedOptionId === o.id;
            return (
              <Card key={o.id} className={cx("flex w-[85%] shrink-0 snap-center flex-col sm:w-auto", chosen && "ring-2 ring-[color:var(--accent)]")} data-testid="option-card">
                <div className="border-b border-line p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-2xl">Option {o.label}</div>
                    <div className="text-sm text-muted">{rate(o.ratePct)} · {o.interestOnly ? `IO ${o.ioYears}y` : `${o.termYears}-yr fixed`}</div>
                  </div>
                  <div className="mt-1 flex min-h-6 flex-wrap gap-1">{tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}</div>
                  <div className="mt-4 text-xs text-muted">Monthly payment (PITIA)</div>
                  <div className="num font-display text-4xl text-ink">{usd(r.pitia)}</div>
                  <div className="mt-1 text-sm text-ink-2">DSCR <strong className="num">{ratio(r.dscr)}</strong> · cash flow <span className={cx("num font-semibold", r.monthlyCashFlow >= 0 ? "text-good" : "text-bad")}>{usd(r.monthlyCashFlow)}/mo</span></div>
                </div>
                <dl className="flex-1 space-y-2 p-5 text-sm">
                  {[
                    ["Loan amount", `${usd(o.loanAmount)} · ${pct(r.ltv)} LTV`],
                    [o.interestOnly ? "Interest-only payment" : "Principal & interest", usd(r.pi)],
                    ...(r.postIoPITIA ? [["Payment after IO period", usd(r.postIoPITIA)]] : []),
                    ["Prepayment penalty", PREPAY_LABEL[o.prepay as PrepayType]],
                    ["Points", `${o.pointsPct}% · ${usd(r.pointsCost)}`],
                    ["Lender fees", usd(o.lenderFees)],
                    ...(purchase ? [["Down payment", usd(r.downPayment)]] : []),
                    [purchase ? "Est. cash to close*" : "Est. upfront costs*", usd(r.cashToClose)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="num text-right font-medium text-ink">{v}</dd></div>
                  ))}
                </dl>
                <div className="p-5 pt-0"><InterestButton endpoint={`${api}/interest`} optionId={o.id} label={o.label} chosen={chosen} brokerFirstName={first} /></div>
              </Card>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">*Excludes title, escrow, appraisal, prepaid interest and reserves, which depend on the lender and state. Payments include estimated taxes, insurance{s.hoaMonthly ? " and HOA" : ""}. DSCR = rent ÷ PITIA.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={`/b/${slug}/s/${token}/pdf`} className={buttonClass("secondary", "md")} target="_blank">Download PDF</a>
          {broker.phone && <a href={`tel:${broker.phone.replace(/[^\d+]/g, "")}`} className={buttonClass("ghost", "md")}>Questions? Call {first}</a>}
        </div>
      </section>
    </PublicShell>
  );
}
