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
      brand={{ name: agency.name, subtitle: "Agency admin", logoUrl: agency.logoUrl }}
    >
      {children}
    </Shell>
  );
}
