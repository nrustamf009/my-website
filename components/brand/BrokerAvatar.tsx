import { initials } from "@/lib/format";

/** Broker logo if present, otherwise initials on the theme accent (per-theme monograms arrive with the design primitives). */
export function BrokerAvatar({ broker, size = 40 }: { broker: { logoUrl: string | null; companyName: string; accentColor: string }; size?: number }) {
  if (broker.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={broker.logoUrl} alt={broker.companyName} width={size} height={size} className="shrink-0 rounded-xl border border-line bg-surface object-contain p-1" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-accent font-semibold text-on-accent" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(broker.companyName)}
    </span>
  );
}
