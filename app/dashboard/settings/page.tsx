import { requireBroker } from "@/lib/auth/session";
import { licensedStates } from "@/lib/broker";
import { BrandingForm, LicensingForm } from "@/components/settings/forms";

export const metadata = { title: "Settings" };

export default async function SettingsHome() {
  const { broker, user } = await requireBroker({ manage: true });
  return (
    <>
      <BrandingForm broker={broker} />
      <LicensingForm broker={broker} user={user} states={licensedStates(broker)} />
    </>
  );
}
