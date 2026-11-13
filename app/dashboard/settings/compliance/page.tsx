import { requireBroker } from "@/lib/auth/session";
import { dateTime } from "@/lib/format";
import { DEFAULT_DISCLAIMER } from "@/lib/compliance/disclaimers";
import { Badge, Card, CardHeader } from "@/components/ui";
import { DisclaimerForm } from "@/components/settings/DisclaimerForm";

export const metadata = { title: "Disclaimers" };

export default async function Compliance() {
  const { broker, db } = await requireBroker({ manage: true });
  const versions = await db.disclaimerVersion.findMany({ orderBy: { version: "desc" } });
  const current = versions.find((v) => v.id === broker.currentDisclaimerId);
  return (
    <>
      <DisclaimerForm current={current?.text ?? DEFAULT_DISCLAIMER} />
      <Card>
        <CardHeader title="Version history" />
        <ul className="divide-y divide-line">
          {versions.map((v) => (
            <li key={v.id} className="px-5 py-3 text-sm">
              <div className="flex items-center justify-between"><span className="font-medium">v{v.version} {v.id === broker.currentDisclaimerId && <Badge tone="good">current</Badge>}</span><span className="text-xs text-muted">{dateTime(v.createdAt)}</span></div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{v.text}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
