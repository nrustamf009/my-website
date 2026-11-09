import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { evaluateAll, PREPAY_LABEL, settingsFromBroker, type PrepayType } from "@/lib/dscr";
import { relativeTime, shortDate, usd } from "@/lib/format";
import { updateMarketRate } from "@/lib/actions/moneylist";
import { Button, Card, EmptyState, Input, LinkButton, PageHeader, Stat } from "@/components/ui";
import { OpportunityCard } from "@/components/moneylist/OpportunityCard";
import { DigestButton } from "@/components/moneylist/DigestButton";

export const metadata = { title: "Money List" };

export default async function MoneyList() {
  const { broker } = await requireBroker();
  const loans = await prisma.closedLoan.findMany({ where: { brokerId: broker.id } });
  const settings = settingsFromBroker(broker);
  const all = evaluateAll(loans, settings);
  const open = all.filter((x) => !x.loan.contactedAt);
  const done = all.filter((x) => x.loan.contactedAt);
  const totalMonthly = open.reduce((s, x) => s + (x.opp.monthlySavings ?? 0), 0);
  const totalCash = open.reduce((s, x) => s + (x.opp.cashOut ?? 0), 0);

  const view = (x: (typeof all)[number], i: number) => ({
    loanId: x.loan.id,
    borrowerName: x.loan.borrowerName,
    email: x.loan.email,
    phone: x.loan.phone,
    propertyAddress: x.loan.propertyAddress,
    facts: `${usd(x.loan.loanAmount)} at ${x.loan.ratePct}%${x.loan.interestOnly ? " IO" : ""} · closed ${shortDate(x.loan.closingDate)} · ${PREPAY_LABEL[(x.loan.prepayType as PrepayType)] ?? x.loan.prepayType}`,
    reasons: x.opp.reasons,
    benefit: x.opp.benefit,
    draft: x.loan.draftMessage,
    contacted: Boolean(x.loan.contactedAt),
    rank: i + 1,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Money List"
        subtitle="Past clients who could benefit from a call right now, ranked by estimated benefit to them."
        actions={<><DigestButton /><LinkButton href="/dashboard/money-list/import" variant="accent">Import loans</LinkButton></>}
      />

      <Card className="mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <form action={updateMarketRate} className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Today's DSCR market rate</span>
            <div className="relative w-36"><Input name="marketRate" type="number" step="0.125" min={1} max={20} defaultValue={broker.marketRate ?? ""} placeholder="6.750" className="pr-7" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span></div>
          </label>
          <Button variant="secondary">Update</Button>
        </form>
        <p className="text-sm text-muted md:ml-4 md:border-l md:border-line md:pl-6">
          Rules: prepay ends within {settings.prepayWindowDays} days (or ended in the last {settings.lookbackDays}) · seasoning reached at {settings.seasoningMonths.join(" / ")} months · rate {settings.rateDropThreshold} pts above market.{" "}
          {broker.marketRateUpdatedAt && <>Rate updated {relativeTime(broker.marketRateUpdatedAt)}. </>}
          <a href="/dashboard/settings#money-list" className="text-accent underline">Edit rules</a>
        </p>
      </Card>

      {loans.length === 0 ? (
        <EmptyState title="Import your closed loans" body="Upload a CSV of past DSCR loans. We'll find clients whose prepay is ending, who've hit cash-out seasoning, or whose rate is well above today's market." action={<LinkButton href="/dashboard/money-list/import">Import CSV</LinkButton>} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Opportunities" value={open.length} hint={`in ${loans.length} closed loans`} />
            <Stat label="Contacted" value={done.length} />
            <Stat label="Client savings" value={usd(totalMonthly)} hint="per month, combined" />
            <Stat label="Cash-out potential" value={usd(totalCash)} hint="estimated, combined" />
          </div>
          {open.length === 0 ? (
            <EmptyState title="No open opportunities" body="Nobody matches your rules right now. Try updating the market rate, or check back next month." />
          ) : (
            <div className="space-y-3">{open.map((x, i) => <OpportunityCard key={x.loan.id} o={view(x, i)} />)}</div>
          )}
          {done.length > 0 && (
            <>
              <h2 className="mb-3 mt-10 font-display text-xl">Contacted</h2>
              <div className="space-y-3">{done.map((x, i) => <OpportunityCard key={x.loan.id} o={view(x, i)} />)}</div>
            </>
          )}
          <p className="mt-6 text-xs text-muted">Estimates: savings compare current P&I with a new 30-year loan on the estimated balance at the market rate. Cash-out assumes 75% LTV at closing, 3%/yr appreciation and a 75% cash-out LTV. Confirm with an appraisal and lender pricing.</p>
        </>
      )}
    </div>
  );
}
