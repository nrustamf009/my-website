import { PageHeader } from "@/components/ui";
import { BrokerForm } from "../BrokerForm";

export const metadata = { title: "Add broker" };

export default function NewBroker() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a broker" subtitle="Creates the broker tenant and a login. The broker can then sign in with a magic link and finish branding in Settings." />
      <BrokerForm />
    </div>
  );
}
