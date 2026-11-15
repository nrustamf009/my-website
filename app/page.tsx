import Link from "next/link";
import { ProductMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui";
import { DEMO_BROKERS, DEMO_MODULES, demoBroker, demoLoginEnabled, demoModuleHref } from "@/lib/auth/demo";

/** One short line per module: what you get when you tap it. */
const ONE_LINER: Record<string, string> = {
  check: "Investor enters a rental, sees DSCR",
  scenarios: "2–3 loan options on one link",
  "money-list": "Past clients ready to refinance",
  snapshots: "Realtor flyer with a QR code",
  notes: "Call notes become a quote",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const broker = demoBroker(b);
  const demo = demoLoginEnabled();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-12 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <ProductMark />
        {!demo && <Link href="/login" className={buttonClass("secondary", "sm")}>Sign in</Link>}
      </header>

      <h1 className="pt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
        DSCR toolkit for brokers
      </h1>
      <p className="mt-2 text-ink-2">Pick a look, then tap a module.</p>

      <div role="radiogroup" aria-label="Demo broker" className="mt-6 grid grid-cols-3 gap-1 rounded-xl bg-surface-alt p-1">
        {DEMO_BROKERS.map((d) => {
          const on = d.slug === broker.slug;
          return (
            <a
              key={d.slug}
              href={`/?b=${d.slug}`}
              role="radio"
              aria-checked={on}
              className={`rounded-lg px-2 py-2.5 text-center text-sm font-medium focus-accent ${on ? "bg-inverse text-on-inverse shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {d.theme}
            </a>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted">{broker.name}</p>

      <ol className="mt-6 grid gap-3">
        {DEMO_MODULES.map((m) => (
          <li key={m.key}>
            <a
              href={demoModuleHref(m, broker.slug)}
              className="group flex items-center gap-4 rounded-xl border-2 border-rule bg-surface p-4 transition hover:border-ink focus-accent active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-inverse font-mono text-lg font-medium text-on-inverse">{m.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{m.title}</span>
                <span className="block truncate text-sm text-muted">{ONE_LINER[m.key]}</span>
              </span>
              <span aria-hidden className="text-xl text-ink transition group-hover:translate-x-1">→</span>
              <span className="sr-only">Open module {m.n}</span>
            </a>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a href={`/go?as=${broker.slug}&to=%2Fdashboard`} className={buttonClass("secondary", "md")}>Dashboard</a>
        <a href={`/go?as=${broker.slug}&to=%2Fdashboard%2Fleads`} className={buttonClass("secondary", "md")}>Leads</a>
        <a href={`/go?as=${broker.slug}&to=%2Fdashboard%2Fsettings%2Fappearance`} className={buttonClass("secondary", "md")}>Theme</a>
        <a href="/go?as=agency&to=%2Fadmin" className={buttonClass("secondary", "md")}>Agency</a>
      </div>

      <p className="mt-10 text-xs text-muted">Demo data. Estimates only, not an offer to lend.</p>
    </main>
  );
}
