import { requireBroker } from "@/lib/auth/session";
import { env, providerModes } from "@/lib/env";
import { PageHeader } from "@/components/ui";
import { CallInput } from "@/components/calls/CallInput";

export const metadata = { title: "New call" };

export default async function NewCall() {
  await requireBroker();
  const modes = providerModes();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Call-to-Scenario" subtitle="Turn a discovery call into a draft scenario, a document checklist and a follow-up email. You review everything before it goes out." />
      <CallInput blobEnabled={Boolean(env.blobToken)} transcriptionMode={modes.transcription} aiMode={modes.ai} />
    </div>
  );
}
