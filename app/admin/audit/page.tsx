import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Card, PageHeader, Td, Th } from "@/components/ui";

export const metadata = { title: "Audit log" };

export default async function Audit() {
  const { agency } = await requireAdmin();
  const [rows, brokers, users] = await Promise.all([
    prisma.auditLog.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.broker.findMany({ where: { agencyId: agency.id }, select: { id: true, companyName: true } }),
    prisma.user.findMany({ where: { agencyId: agency.id }, select: { id: true, email: true } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Audit log" subtitle="Impersonation, broker creation, status and module changes, invitations." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-160">
          <thead className="bg-paper"><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Broker</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap">{dateTime(r.createdAt)}</Td>
                <Td>{users.find((u) => u.id === r.actorUserId)?.email ?? r.actorUserId}</Td>
                <Td className="font-mono text-xs">{r.action}</Td>
                <Td>{brokers.find((b) => b.id === r.targetBrokerId)?.companyName ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
