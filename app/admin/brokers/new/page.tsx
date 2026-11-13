import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { isThemeId } from "@design";
import { NewBrokerForm } from "../NewBrokerForm";

export const metadata = { title: "Add broker" };

export default async function NewBroker() {
  const { agency } = await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a broker client" subtitle="Creates the tenant with default program grid, disclaimer v1 and all modules on (trial)." />
      <NewBrokerForm defaultTheme={isThemeId(agency.defaultTheme) ? agency.defaultTheme : "maison"} />
    </div>
  );
}
