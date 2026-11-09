import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireBroker, IMPERSONATE_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/dashboard/Shell";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";

export const dynamic = "force-dynamic";

async function stopImpersonating() {
  "use server";
  (await cookies()).delete(IMPERSONATE_COOKIE);
  redirect("/admin");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, broker, impersonating } = await requireBroker();
  const newLeads = await prisma.lead.count({ where: { brokerId: broker.id, status: "NEW" } });
  const items = [
    { href: "/dashboard", label: "Overview", icon: "home" },
    { href: "/dashboard/leads", label: "Leads", icon: "users", badge: newLeads || undefined },
    { href: "/dashboard/snapshots", label: "Listing Snapshots", icon: "camera" },
    { href: "/dashboard/money-list", label: "Money List", icon: "money" },
    { href: "/dashboard/scenarios", label: "Scenarios", icon: "layers" },
    { href: "/dashboard/calls", label: "Call-to-Scenario", icon: "phone" },
    { href: "/dashboard/settings", label: "Settings", icon: "gear" },
  ];
  return (
    <Shell
      items={items}
      accent={broker.accentColor}
      userLabel={session.user.email}
      banner={
        impersonating ? (
          <div className="flex items-center justify-center gap-3 bg-ink px-4 py-2 text-sm text-white">
            <span>Viewing as <strong>{broker.name}</strong> ({broker.companyName})</span>
            <form action={stopImpersonating}><button className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25">Stop impersonating</button></form>
          </div>
        ) : null
      }
      header={
        <div className="flex items-center gap-3">
          <BrokerAvatar broker={broker} size={40} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{broker.name}</div>
            <div className="truncate text-xs text-muted">{broker.companyName}</div>
          </div>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
