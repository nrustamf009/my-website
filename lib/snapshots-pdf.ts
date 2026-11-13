import type { Broker, Realtor, Snapshot } from "@prisma/client";
import type { PublicBrand } from "@/lib/broker";
import type { EngineContext, ListingInput, PropertyType, UsState } from "@/lib/dscr";
import { env } from "@/lib/env";
import { renderSnapshotPdf } from "@/lib/pdf/SnapshotPdf";

export const listingInputOf = (s: Snapshot): ListingInput => ({
  state: s.state as UsState,
  propertyType: s.propertyType as PropertyType,
  listPriceCents: s.listPriceCents,
  rentCents: s.rentCents,
  taxesAnnualCents: s.taxesAnnualCents,
  insuranceAnnualCents: s.insuranceAnnualCents,
  hoaMonthlyCents: s.hoaMonthlyCents,
  rateMilli: s.rateMilli,
});

export const snapshotUrl = (broker: Pick<Broker, "slug">, s: Pick<Snapshot, "token">) => `${env.appUrl}/b/${broker.slug}/l/${s.token}?src=qr`;

export function snapshotPdf(broker: Broker, brand: PublicBrand, ctx: EngineContext, s: Snapshot & { realtor: Realtor }, template?: "CLASSIC" | "MODERN") {
  return renderSnapshotPdf({
    brand,
    ctx,
    template: template ?? (s.template === "MODERN" ? "MODERN" : "CLASSIC"),
    address: s.address,
    listing: listingInputOf(s),
    photoUrl: s.photoUrl,
    rentSource: s.rentSource,
    realtor: { name: s.realtor.name, brokerage: s.realtor.brokerage, phone: s.realtor.phone, email: s.realtor.email, headshotUrl: s.realtor.headshotUrl, logoUrl: s.realtor.logoUrl },
    url: snapshotUrl(broker, s),
  });
}
