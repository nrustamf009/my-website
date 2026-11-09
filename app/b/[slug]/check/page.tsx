import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brokerDefaults, getActiveBrokerBySlug } from "@/lib/broker";
import { pickPublic } from "@/lib/leads";
import { PublicShell } from "@/components/public/PublicShell";
import { InstantCheck } from "@/components/public/InstantCheck";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const broker = await getActiveBrokerBySlug((await params).slug);
  return broker ? { title: { absolute: `DSCR Instant Check · ${broker.companyName}` }, description: `See if a rental property qualifies for a DSCR loan in seconds. ${broker.companyName}, NMLS #${broker.nmlsId}.` } : {};
}

export default async function CheckPage({ params }: { params: Promise<{ slug: string }> }) {
  const broker = await getActiveBrokerBySlug((await params).slug);
  if (!broker) notFound();
  const first = broker.name.split(" ")[0]!;
  return (
    <PublicShell broker={pickPublic(broker)}>
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-8 sm:px-6 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">DSCR Instant Check</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">Will this rental qualify for a DSCR loan?</h1>
        <p className="mt-3 max-w-2xl text-base text-ink-2 sm:text-lg">DSCR loans are approved on the property's rent, not your W-2s or tax returns. Enter the deal and see where you stand in seconds.</p>
      </section>
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <InstantCheck slug={broker.slug} brokerFirstName={first} brokerPhone={broker.phone} defaults={brokerDefaults(broker)} />
      </section>
      <section className="mx-auto mt-12 grid max-w-6xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
        {[
          ["What is DSCR?", "Debt Service Coverage Ratio = monthly rent ÷ monthly payment (principal, interest, taxes, insurance and HOA). 1.00 means rent exactly covers the payment."],
          ["What lenders look for", `Most programs want 1.00 or higher. ${first} uses ${brokerDefaults(broker).minDscr.toFixed(2)} as the starting point and shops multiple DSCR lenders.`],
          ["No tax returns", "Qualification is based on the property, credit score and down payment. No personal income documentation, and no SSN needed for this check."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-2xl border border-line bg-white p-5">
            <h3 className="font-semibold text-ink">{t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{b}</p>
          </div>
        ))}
      </section>
    </PublicShell>
  );
}
