import { requireBroker } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/settings/Tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireBroker({ manage: true });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Branding, team, program defaults, compliance text and integrations." />
      <SettingsTabs />
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}
