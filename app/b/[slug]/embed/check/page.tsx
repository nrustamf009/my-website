import { notFound } from "next/navigation";
import { getPublicContext } from "@/lib/broker";
import { formFromQuery } from "@/lib/check/form";
import { turnstileSiteKey } from "@/lib/providers/bot";
import { paletteVars } from "@/lib/brand/palette";
import { BrokerFooter } from "@/components/public/BrokerFooter";
import { UnavailablePage } from "@/components/public/PublicShell";
import { InstantCheck } from "@/components/public/InstantCheck";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** Chrome-less version for iframes on the broker's own site (keeps the compliance footer). */
export default async function EmbedCheck({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const q = await searchParams;
  const pc = await getPublicContext(slug, { loSlug: typeof q.lo === "string" ? q.lo : null, feature: "check" });
  if (!pc) notFound();
  if (pc.unavailable) return <UnavailablePage />;
  return (
    <div className="bg-paper p-3 sm:p-4" style={paletteVars(pc.brand.accentColor) as React.CSSProperties}>
      <InstantCheck slug={slug} loSlug={pc.brand.lo.slug} ctx={pc.ctx} companyName={pc.broker.companyName} loFirstName={pc.brand.lo.name.split(" ")[0]!} loPhone={pc.brand.lo.phone} privacyPolicyUrl={pc.brand.privacyPolicyUrl} turnstileSiteKey={turnstileSiteKey()} initial={formFromQuery(q, {})} embed />
      <BrokerFooter brand={pc.brand} compact />
    </div>
  );
}
