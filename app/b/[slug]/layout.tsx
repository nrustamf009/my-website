import { notFound } from "next/navigation";
import { getActiveBrokerBySlug } from "@/lib/broker";

export const dynamic = "force-dynamic";

export default async function BrokerPublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const broker = await getActiveBrokerBySlug(slug);
  if (!broker) notFound();
  return <div style={{ "--accent": broker.accentColor } as React.CSSProperties}>{children}</div>;
}
