import { notFound } from "next/navigation";
import { brokerDefaults, getActiveBrokerBySlug } from "@/lib/broker";
import { pickPublic } from "@/lib/leads";
import { ComplianceFooter } from "@/components/public/PublicShell";
import { InstantCheck } from "@/components/public/InstantCheck";

export const metadata = { robots: { index: false } };

/** Chrome-less version for iframes on the broker's own website. */
export default async function EmbedCheck({ params }: { params: Promise<{ slug: string }> }) {
  const broker = await getActiveBrokerBySlug((await params).slug);
  if (!broker) notFound();
  return (
    <div className="bg-paper p-3 sm:p-4">
      <InstantCheck slug={broker.slug} brokerFirstName={broker.name.split(" ")[0]!} brokerPhone={broker.phone} defaults={brokerDefaults(broker)} embed />
      <ComplianceFooter broker={pickPublic(broker)} compact />
    </div>
  );
}
