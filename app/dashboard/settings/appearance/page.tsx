import { requireBroker } from "@/lib/auth/session";
import { isThemeId } from "@design";
import { AppearanceForm } from "@/components/settings/Appearance";

export const metadata = { title: "Appearance" };

export default async function AppearancePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { broker, db } = await requireBroker({ manage: true });
  const snap = await db.snapshot.findFirst({ orderBy: { createdAt: "desc" }, select: { token: true } });
  return <AppearanceForm slug={broker.slug} theme={isThemeId(broker.theme) ? broker.theme : "maison"} accent={broker.accentColor} logoOnDarkUrl={broker.logoOnDarkUrl} listingToken={snap?.token ?? null} saved={(await searchParams).saved === "1"} />;
}
