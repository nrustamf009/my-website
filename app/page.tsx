import Link from "next/link";
import { ProductMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui";
import { DEMO_BROKERS, DEMO_MODULES, demoBroker, demoLoginEnabled, demoModuleHref } from "@/lib/auth/demo";

const ABOUT: Record<string, { who: string; body: string }> = {
  check: { who: "Investor · public page", body: "Price, rent and down payment in; DSCR, verdict, payment, cash to close and what to change out. Contact info unlocks the PDF estimate." },
  scenarios: { who: "Loan officer → investor", body: "Two or three loan options side by side on a private mobile link with a PDF. See when the investor opens it and which option they pick." },
  "money-list": { who: "Loan officer · closed loans", body: "Closed loans from the LOS, re-checked daily for prepay expiry, seasoning, rate drops and ARM resets, ranked by benefit, with drafted outreach." },
  snapshots: { who: "Loan officer → realtor", body: "A co-branded one-page flyer for a listing: payment, DSCR and cash flow at 20% and 25% down, with a QR code to a live financing page." },
  notes: { who: "Loan officer · after a call", body: "Paste call notes or an email. Review the extracted deal, then get a draft scenario, a document checklist and a follow-up email." },
};

const THEME_NOTE: Record<string, string> = {
  maison: "Calm, private-bank green",
  terminal: "Dense, mono, trading-desk",
  atelier: "Bright, bold, editorial",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const broker = demoBroker(b);
  const demo = demoLoginEnabled();

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <ProductMark />
        {!demo && <Link href="/login" className={buttonClass("secondary", "sm")}>Sign in</Link>}
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-6 sm:pt-12">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">DSCR loans · white-label for brokers</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          Five tools for brokers who lend on rental income.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">
          Pick a demo broker, then open any module. No sign-in. Every broker has its own brand and one of three looks.
        </p>
      </section>

      <section aria-labelledby="pick-broker" className="mx-auto max-w-6xl px-5">
        <h2 id="pick-broker" className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Demo broker</h2>
        <div className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-3">
          {DEMO_BROKERS.map((d) => {
            const on = d.slug === broker.slug;
            return (
              <a
                key={d.slug}
                href={`/?b=${d.slug}`}
                aria-current={on ? "true" : undefined}
                className={`flex flex-col gap-1 p-4 focus-accent ${on ? "bg-inverse text-on-inverse" : "bg-surface text-ink hover:bg-surface-alt"}`}
              >
                <span className="font-medium">{d.name}</span>
                <span className={`font-mono text-xs ${on ? "text-on-inverse-muted" : "text-muted"}`}>{d.theme} · {THEME_NOTE[d.theme]}</span>
              </a>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="modules" className="mx-auto max-w-6xl px-5 py-10">
        <h2 id="modules" className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Modules · {broker.name}</h2>
        <ol className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {DEMO_MODULES.map((m) => (
            <li key={m.key} className="flex flex-col bg-surface">
              <a href={demoModuleHref(m, broker.slug)} className="group flex flex-1 flex-col gap-3 p-5 focus-accent hover:bg-surface-alt">
                <span className="num font-mono text-sm text-accent-text">0{m.n}</span>
                <span className="font-display text-xl font-semibold text-ink">{m.title}</span>
                <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{ABOUT[m.key].who}</span>
                <span className="text-sm leading-relaxed text-ink-2">{ABOUT[m.key].body}</span>
                <span className="mt-auto pt-2 text-sm font-medium text-accent-text group-hover:underline">Open module {m.n} →</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={`/go?as=${broker.slug}&to=%2Fdashboard`} className={buttonClass("primary", "md")}>Broker dashboard</a>
          <a href={`/go?as=${broker.slug}&to=%2Fdashboard%2Fleads`} className={buttonClass("secondary", "md")}>Leads</a>
          <a href={`/go?as=${broker.slug}&to=%2Fdashboard%2Fsettings%2Fappearance`} className={buttonClass("secondary", "md")}>Theme settings</a>
          <a href="/go?as=agency&to=%2Fadmin" className={buttonClass("secondary", "md")}>Agency admin</a>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-line px-5 py-8 text-xs text-muted">
        All brokers, people and numbers are fictional demo data. No MLS, credit bureau or lender data. Every estimate is labeled as an estimate, not an offer to lend.
      </footer>
    </main>
  );
}
