import { PageHeader } from "@/components/ui";
import { NewBrokerForm } from "../NewBrokerForm";

export const metadata = { title: "Add broker" };

export default function NewBroker() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a broker client" subtitle="Creates the tenant with default program grid, disclaimer v1 and all modules on (trial)." />
      <NewBrokerForm />
    </div>
  );
}
