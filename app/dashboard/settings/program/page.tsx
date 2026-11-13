import { requireBroker } from "@/lib/auth/session";
import { engineContext } from "@/lib/broker";
import { ProgramForm } from "@/components/settings/forms";

export const metadata = { title: "Program grid" };

export default async function Program() {
  const { broker } = await requireBroker({ manage: true });
  return <ProgramForm grid={engineContext(broker).grid} full />;
}
