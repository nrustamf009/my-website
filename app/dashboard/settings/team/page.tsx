import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { setUserActive } from "@/lib/actions/settings";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { InviteForm } from "@/components/settings/TeamForm";

export const metadata = { title: "Team" };

export default async function Team() {
  const { broker, user } = await requireBroker({ manage: true });
  const users = await prisma.user.findMany({ where: { brokerId: broker.id }, orderBy: { createdAt: "asc" } });
  return (
    <Card>
      <CardHeader title="Loan officers" subtitle="Each LO signs in with a magic link, has their own public links, and owns their leads and scenarios." />
      <ul className="divide-y divide-line">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="min-w-0">
              <span className="block font-medium">{u.name ?? u.email} {u.role === "BROKER_ADMIN" && <Badge tone="accent">admin</Badge>} {!u.active && <Badge tone="bad">inactive</Badge>}</span>
              <span className="block truncate text-xs text-muted">{u.email}{u.nmlsId ? ` · NMLS #${u.nmlsId}` : " · NMLS missing"}</span>
            </span>
            {u.id !== user?.id && (
              <form action={setUserActive.bind(null, u.id, !u.active)}><Button size="sm" variant="ghost">{u.active ? "Deactivate" : "Reactivate"}</Button></form>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-line p-5"><InviteForm /></div>
    </Card>
  );
}
