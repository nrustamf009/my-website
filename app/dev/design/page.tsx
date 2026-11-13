import { notFound } from "next/navigation";
import { demoLoginEnabled } from "@/lib/auth/config";
import { DEFAULT_CONTEXT } from "@/lib/dscr";
import { isThemeId } from "@design";
import { Gallery } from "@design/gallery/Gallery";
import { fixtureAnalysis, fixtureScenario } from "@design/gallery/fixture";

export const metadata = { title: "Design gallery", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every surface × 3 themes from the golden fixture (DESIGN.md §11). Development and demo only. */
export default async function DesignGallery({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  if (!demoLoginEnabled()) notFound();
  const { theme } = await searchParams;
  const options = fixtureScenario().map((o) => ({ label: o.label, recommended: o.recommended, product: o.product, rateMilli: o.rateMilli, pointsRatio: o.pointsRatio, prepay: o.prepay, result: o.result }));
  return <Gallery data={{ a: fixtureAnalysis(), min: DEFAULT_CONTEXT.grid.minDscrRatio, strong: DEFAULT_CONTEXT.grid.strongDscrRatio, options }} only={isThemeId(theme) ? theme : null} />;
}
