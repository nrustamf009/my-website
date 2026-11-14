import type { Broker } from "@prisma/client";
import { getStaffSession } from "@/lib/auth/session";
import { isThemeId, type ThemeId } from "@design";
import type { PublicBrand } from "@/lib/broker";

/**
 * Settings → Appearance preview (?previewTheme=&previewAccent=). Honored only for a signed-in user of this
 * broker, an admin of its agency, or a demo broker; public visitors can never restyle a broker.
 */
export async function withPreview(brand: PublicBrand, broker: Pick<Broker, "id" | "agencyId" | "isDemo">, q: Record<string, string | string[] | undefined>): Promise<PublicBrand> {
  const theme = typeof q.previewTheme === "string" && isThemeId(q.previewTheme) ? (q.previewTheme as ThemeId) : null;
  const accent = typeof q.previewAccent === "string" && /^#?[0-9a-fA-F]{6}$/.test(q.previewAccent) ? `#${q.previewAccent.replace("#", "")}` : null;
  if (!theme && !accent) return brand;
  if (!broker.isDemo) {
    const session = await getStaffSession();
    const u = session?.user;
    if (!u || !(u.brokerId === broker.id || (u.role === "AGENCY_ADMIN" && u.agencyId === broker.agencyId))) return brand;
  }
  return { ...brand, theme: theme ?? brand.theme, accentColor: accent ?? brand.accentColor };
}
