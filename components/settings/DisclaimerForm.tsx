"use client";

import { useActionState } from "react";
import { publishDisclaimer, type SettingsState } from "@/lib/actions/settings";
import { Button, Card, CardHeader, Notice, Textarea } from "@/components/ui";

export function DisclaimerForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(publishDisclaimer, {});
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Publish a new disclaimer version" subtitle="Shown on every public page, PDF and investor email. Each lead and PDF records the version it saw." />
        <div className="space-y-3 p-5">
          {state.message && <Notice tone="good">{state.message}</Notice>}
          <Textarea name="text" rows={6} defaultValue={current} aria-label="Disclaimer text" />
          {state.fieldErrors?.text && <p className="text-xs text-bad">{state.fieldErrors.text}</p>}
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4"><Button disabled={pending}>Publish new version</Button></div>
      </Card>
    </form>
  );
}
