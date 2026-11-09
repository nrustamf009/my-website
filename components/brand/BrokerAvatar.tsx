import { initials } from "@/lib/format";

/** Broker logo if present, otherwise initials on the accent color. */
export function BrokerAvatar({ broker, size = 40 }: { broker: { logoUrl: string | null; companyName: string; accentColor: string }; size?: number }) {
  if (broker.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={broker.logoUrl} alt={broker.companyName} width={size} height={size} className="shrink-0 rounded-xl border border-line bg-white object-contain p-1" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-xl font-semibold text-white" style={{ width: size, height: size, background: broker.accentColor, fontSize: size * 0.36 }}>
      {initials(broker.companyName)}
    </span>
  );
}
