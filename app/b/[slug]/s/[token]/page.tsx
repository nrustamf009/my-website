import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { computeOptions, publicState } from "@/lib/scenarios";
import { loadPublicScenario } from "@/lib/scenario-public";
import { shortDate, usd } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { PublicShell, UnavailablePage } from "@/components/public/PublicShell";
import { ScenarioOptions, type PublicOption } from "@/components/public/ScenarioOptions";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";

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

  return (
    <PublicShell brand={pc.brand}>
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-8 sm:px-6 sm:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t.scenario.eyebrow(s.investorName.split(" ")[0]!)}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink sm:text-5xl" data-testid="scenario-address">{s.propertyAddress}</h1>
        <p className="mt-2 text-sm text-muted">{t.mode[s.mode as "PURCHASE"]} · {s.mode === "PURCHASE" ? "Price" : "Value"} {usd(s.valueCents)} · Rent {usd(s.rentCents)}/mo</p>
        <p className="mt-1 text-xs text-muted">{t.scenario.pricingAsOf(shortDate(s.updatedAt), shortDate(s.expiresAt))}</p>
        {s.note && (
          <div className="mt-5 flex max-w-2xl gap-3 rounded-2xl border border-line bg-card p-4">
            <BrokerAvatar broker={{ logoUrl: lo.headshotUrl ?? pc.brand.logoUrl, companyName: lo.name, accentColor: pc.brand.accentColor }} size={36} />
            <p className="text-sm text-ink-2"><span className="font-medium text-ink">{first}:</span> {s.note}</p>
          </div>
        )}
      </section>
      <section className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <ScenarioOptions slug={slug} token={token} options={options} mode={s.mode} loFirstName={first} initialPicked={s.interestedOptionId} hasPayoff={s.currentBalanceCents != null} />
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-10 sm:px-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-xl text-ink">{t.scenario.nextSteps}</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
            <li>Pick the option that fits your plans (you can switch later).</li>
            <li>{first} confirms rent, taxes and insurance and checks current pricing.</li>
            <li>When you&apos;re ready, lock the rate and start the application.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {tel && <a href={`tel:${tel}`} className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent">Call {first}</a>}
            {tel && <a href={`sms:${tel}`} className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink">Text</a>}
            <a href={`/api/public/${slug}/s/${token}/pdf`} className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink" data-testid="scenario-pdf">Download PDF</a>
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
