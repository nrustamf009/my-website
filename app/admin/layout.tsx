import { requireAdmin } from "@/lib/auth/session";
import { Shell } from "@/components/dashboard/Shell";
import { ADMIN_THEME } from "@design";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, agency } = await requireAdmin();
  return (
    <Shell
      theme={ADMIN_THEME.id}
      accent={ADMIN_THEME.accent}
      userLabel={session.user.email}
      items={[
        { href: "/admin", label: "Overview", icon: "chart" },
        { href: "/admin/brokers", label: "Brokers", icon: "building" },
        { href: "/admin/audit", label: "Audit log", icon: "layers" },
      ]}
      header={
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Agency admin</div>
          <div className="mt-0.5 truncate text-sm font-semibold">{agency.name}</div>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
