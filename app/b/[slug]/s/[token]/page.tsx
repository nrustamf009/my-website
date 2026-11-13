import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { computeOptions, publicState } from "@/lib/scenarios";
import { loadPublicScenario } from "@/lib/scenario-public";
import { pct, shortDate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { PublicShell, UnavailablePage } from "@/components/public/PublicShell";
import { ScenarioOptions, type PublicOption } from "@/components/public/ScenarioOptions";
import { BrokerMark, SectionTitle } from "@design/components/primitives";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, token } = await params;
  const r = await loadPublicScenario(slug, token);
  if (!r || r.pc.unavailable) return { title: "Loan options" };
  return { title: { absolute: `Loan options · ${r.s.propertyAddress}` }, robots: { index: false, follow: false } };
}

export default async function PublicScenario({ params }: Props) {
  const { slug, token } = await params;
  const r = await loadPublicScenario(slug, token);
  if (!r) notFound();
  const { pc, s } = r;
  if (pc.unavailable) return <UnavailablePage />;
  const state = publicState(s);
  const lo = pc.brand.lo;
  const first = lo.name.split(" ")[0]!;
  const tel = lo.phone?.replace(/[^\d+]/g, "");

  if (state === "EXPIRED" || state === "REVOKED") {
    return (
      <PublicShell brand={pc.brand}>
        <section className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="scenario-unavailable">
          <h1 className="font-display text-3xl text-ink">{state === "EXPIRED" ? "Pricing has expired" : "Link no longer available"}</h1>
          <p className="mt-3 text-ink-2">{state === "EXPIRED" ? t.scenario.expired : t.scenario.revoked}</p>
          <p className="mt-6 text-sm text-muted">{lo.name} · {[lo.phone, lo.email].filter(Boolean).join(" · ")}</p>
        </section>
      </PublicShell>
    );
  }

  const rows = computeOptions(s, pc.ctx.grid);
  const options: PublicOption[] = rows.map((x) => ({ id: x.option.id, label: x.option.label, recommended: x.option.recommended, product: x.input.product, loanAmountCents: x.input.loanAmountCents, rateMilli: x.input.rateMilli, pointsRatio: x.input.pointsRatio, feesCents: x.input.feesCents, prepay: x.input.prepay, result: x.result, vsFirst: x.vsFirst }));

  const rec = rows.find((r) => r.option.recommended) ?? rows[0]!;
  return (
    <PublicShell brand={pc.brand} surface="Scenario sheet">
      <section className="mx-auto max-w-3xl px-[var(--space-page)] pb-4 pt-8 sm:px-6 sm:pt-12">
        <p className="type-eyebrow text-accent">{t.scenario.eyebrow(s.investorName.split(" ")[0]!)}</p>
        <h1 className="type-h1 mt-2 text-ink" style={{ textWrap: "balance" }} data-testid="scenario-address">{s.propertyAddress}</h1>
        <p className="mt-2 text-ink-2">By {lo.name}, {shortDate(s.updatedAt)}. Figures hold through {shortDate(s.expiresAt)}; rates change daily and are confirmed when you lock.</p>
        <dl className="mt-6 grid grid-cols-3 border-y border-rule">
          {([
            [s.mode === "PURCHASE" ? "Price" : "Value", usd(s.valueCents)],
            [`Loan · ${pct(rec.result.ltvRatio)}`, usd(rec.input.loanAmountCents)],
            ["Est. rent", usd(s.rentCents)],
          ] as const).map(([k, v], i) => (
            <div key={k} className={`py-3 ${i ? "border-l border-rule pl-3" : ""}`}>
              <dt className="type-eyebrow text-muted">{k}</dt>
              <dd className="type-metric-panel num text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {s.note && (
          <div className="mt-5 flex gap-3 border border-rule bg-surface p-4">
            <BrokerMark logoUrl={lo.headshotUrl ?? pc.brand.logoUrl} name={lo.name} size={36} />
            <p className="text-ink-2"><span className="font-medium text-ink">{first}:</span> {s.note}</p>
          </div>
        )}
      </section>
      <section className="mx-auto max-w-3xl px-[var(--space-page)] pt-4 sm:px-6">
        <ScenarioOptions slug={slug} token={token} options={options} mode={s.mode} loFirstName={first} initialPicked={s.interestedOptionId} hasPayoff={s.currentBalanceCents != null} minDscr={pc.ctx.grid.minDscrRatio} strongDscr={pc.ctx.grid.strongDscrRatio} />
        <a href={`/api/public/${slug}/s/${token}/pdf`} className="mt-6 flex items-center justify-between border-y border-rule py-4 font-medium text-ink" data-testid="scenario-pdf">
          Download this comparison as a PDF
          <svg viewBox="0 0 24 24" className="icon h-5 w-5" fill="none" stroke="currentColor" aria-hidden><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>
        </a>
      </section>
      <section className="mx-auto grid max-w-3xl gap-5 px-[var(--space-page)] py-10 sm:px-6">
        <div className="border border-rule bg-surface p-5">
          <SectionTitle>{t.scenario.nextSteps}</SectionTitle>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-2">
            <li>Pick the option that fits your plans (you can switch later).</li>
            <li>{first} confirms rent, taxes and insurance and checks current pricing.</li>
            <li>When you&apos;re ready, lock the rate and start the application.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {tel && <a href={`tel:${tel}`} className="inline-flex h-11 items-center rounded-[var(--radius-control)] bg-accent px-5 text-sm font-semibold text-on-accent">Call {first}</a>}
            {tel && <a href={`sms:${tel}`} className="inline-flex h-11 items-center rounded-[var(--radius-control)] border border-rule bg-surface px-5 text-sm font-semibold text-ink">Text</a>}
          </div>
        </div>
        <details className="rounded-2xl border border-line bg-card p-5">
          <summary className="cursor-pointer font-display text-xl text-ink">{t.scenario.glossary}</summary>
          <dl className="mt-3 space-y-2 text-sm">
            {t.glossary.map(([k, v]) => <div key={k}><dt className="font-medium text-ink">{k}</dt><dd className="text-muted">{v}</dd></div>)}
          </dl>
        </details>
      </section>
    </PublicShell>
  );
}
