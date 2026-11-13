import Link from "next/link";
import { ProductMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui";

const modules = [
  { n: "01", title: "DSCR Instant Check", body: "A branded widget for the broker's site. Investors get a DSCR, a verdict and what to change in seconds, then trade their contact info for the full PDF." },
  { n: "02", title: "Listing Snapshot", body: "A one-page co-branded PDF for realtors with payment, DSCR at 20% and 25% down, and a QR code that turns open-house traffic into tagged leads." },
  { n: "03", title: "Money List", body: "Upload closed loans and see who is ready for a refi: expired prepay, seasoning reached, or rates well below their note. AI drafts the outreach." },
  { n: "04", title: "Scenario Sheet", body: "Compare two or three loan options on one mobile-friendly page. Know the moment the investor opens it, and when they pick an option." },
  { n: "05", title: "Notes-to-Scenario", body: "Paste call notes, an email or a transcript. Review the deal, then get a draft scenario, the document checklist and a follow-up email." },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <ProductMark />
        <Link href="/login" className={buttonClass("secondary", "sm")}>Sign in</Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:pt-20">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">For DSCR loan specialists</p>
        <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-7xl">
          Turn rental numbers into <em className="text-[#9a6b12]">booked calls.</em>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
          Five tools that help mortgage brokers win investor deals: instant DSCR checks, realtor snapshots, scenario sheets, a refi opportunity list, and call notes that become quotes. Each broker gets their own brand.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className={buttonClass("primary", "lg")}>Open the dashboard</Link>
          <Link href="/b/harborline/check" className={buttonClass("secondary", "lg")}>See a live broker page →</Link>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
          {modules.map((m) => (
            <div key={m.n} className="bg-surface p-6">
              <div className="num font-display text-3xl text-[#c9a24a]">{m.n}</div>
              <h3 className="mt-4 font-semibold text-ink">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-muted">
        No MLS, credit bureau or lender data. No SSNs or borrower documents. Every estimate is labeled as an estimate, not an offer to lend.
      </footer>
    </main>
  );
}
