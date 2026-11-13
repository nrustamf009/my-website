import { requireBroker } from "@/lib/auth/session";
import { licensedStates, parseJson } from "@/lib/broker";
import { StatesForm } from "@/components/settings/StatesForm";

export const metadata = { title: "Taxes & insurance" };

export default async function States() {
  const { broker } = await requireBroker({ manage: true });
  return <StatesForm overrides={parseJson(broker.stateOverrides, {})} licensed={licensedStates(broker)} />;
}
