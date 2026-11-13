import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicContext } from "@/lib/broker";
import { formFromQuery } from "@/lib/check/form";
import { turnstileSiteKey } from "@/lib/providers/bot";
import { withPreview } from "@/lib/preview";
import { t } from "@/lib/strings/en";
import { PublicShell, UnavailablePage } from "@/components/public/PublicShell";
import { InstantCheck } from "@/components/public/InstantCheck";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pc = await getPublicContext((await params).slug);
  if (!pc || pc.unavailable) return { title: "Unavailable" };
  return { title: { absolute: `DSCR Instant Check · ${pc.broker.companyName}` }, description: `See if rent covers the loan on an investment property in seconds. ${pc.broker.companyName}, NMLS #${pc.broker.companyNmlsId}.` };
}

export default async function CheckPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = await searchParams;
  const lo = typeof q.lo === "string" ? q.lo : null;
  const pc = await getPublicContext(slug, { loSlug: lo, feature: "check" });
  if (!pc) notFound();
  if (pc.unavailable) return <UnavailablePage />;
  const brand = await withPreview(pc.brand, pc.broker, q);
  const first = pc.brand.lo.name.split(" ")[0]!;
  const defaultState = pc.brand.licensedStates.length === 1 ? pc.brand.licensedStates[0] : undefined;
  return (
    <PublicShell brand={brand} surface="Instant Check">
      <section className="mx-auto max-w-6xl px-[var(--space-page)] pb-6 pt-8 sm:px-6 sm:pt-14">
        <p className="type-eyebrow text-accent">{t.check.eyebrow}</p>
        <h1 className="type-h1 mt-3 max-w-3xl text-ink" style={{ textWrap: "balance" }}>{t.check.title}</h1>
        <p className="mt-3 max-w-2xl text-ink-2">{t.check.subtitle}</p>
      </section>
      <section className="mx-auto max-w-6xl px-[var(--space-page)] sm:px-6">
        <InstantCheck
          slug={slug}
          loSlug={pc.brand.lo.slug}
          ctx={pc.ctx}
          companyName={pc.broker.companyName}
          loFirstName={first}
          loPhone={pc.brand.lo.phone}
          privacyPolicyUrl={pc.brand.privacyPolicyUrl}
          turnstileSiteKey={turnstileSiteKey()}
          initial={formFromQuery(q, { state: defaultState })}
        />
      </section>
    </PublicShell>
  );
}
