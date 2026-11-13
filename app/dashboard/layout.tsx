import { requireBroker } from "@/lib/auth/session";
import { features } from "@/lib/broker";
import { stopImpersonating } from "@/lib/actions/admin";
import { Shell } from "@/components/dashboard/Shell";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, broker, db, impersonating, canManage, user } = await requireBroker();
  const f = features(broker);
  const newLeads = await db.lead.count({ where: { status: "NEW" } });
  const items = [
    { href: "/dashboard", label: "Overview", icon: "home" },
    { href: "/dashboard/leads", label: "Leads", icon: "users", badge: newLeads || undefined },
    ...(f.moneyList ? [{ href: "/dashboard/money-list", label: "Money List", icon: "money" }] : []),
    ...(f.scenario ? [{ href: "/dashboard/scenarios", label: "Scenarios", icon: "layers" }] : []),
    ...(f.snapshot ? [{ href: "/dashboard/snapshots", label: "Listing Snapshots", icon: "camera" }] : []),
    ...(f.notes ? [{ href: "/dashboard/notes", label: "Notes-to-Scenario", icon: "phone" }] : []),
    ...(f.check ? [{ href: "/dashboard/share", label: "Share & embed", icon: "chart" }] : []),
    ...(canManage ? [{ href: "/dashboard/settings", label: "Settings", icon: "gear" }] : []),
  ];
  return (
    <Shell
      items={items}
      accent={broker.accentColor}
      userLabel={session.user.email}
      banner={
        <>
          {impersonating && (
            <div className="flex items-center justify-center gap-3 bg-ink px-4 py-2 text-sm text-white">
              <span>Viewing as <strong>{broker.companyName}</strong> (agency impersonation, logged)</span>
              <form action={stopImpersonating}><button className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25">Stop impersonating</button></form>
            </div>
          )}
          {broker.status === "SUSPENDED" && <div className="bg-bad px-4 py-2 text-center text-sm text-white">This account is suspended: public pages show “unavailable”. Contact your agency.</div>}
          {broker.isDemo && !impersonating && <div className="bg-warn-soft px-4 py-1.5 text-center text-xs text-warn">Demo account · all data is fictional</div>}
        </>
      }
      header={
        <div className="flex items-center gap-3">
          <BrokerAvatar broker={broker} size={40} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{broker.companyName}</div>
            <div className="truncate text-xs text-muted">{user?.name ?? "Agency admin"}{user?.role === "BROKER_ADMIN" ? " · Admin" : ""}</div>
          </div>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
