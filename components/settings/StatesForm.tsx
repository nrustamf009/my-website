"use client";

import { useActionState } from "react";
import { saveStateOverrides, type SettingsState } from "@/lib/actions/settings";
import { STATE_DEFAULTS, STATE_NAMES, US_STATES, type StateDefault, type UsState } from "@/lib/dscr";
import { pct } from "@/lib/format";
import { Button, Card, CardHeader, Input } from "@/components/ui";

export function StatesForm({ overrides, licensed }: { overrides: Partial<Record<UsState, StateDefault>>; licensed: string[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveStateOverrides, {});
  const ordered = [...US_STATES].sort((a, b) => Number(licensed.includes(b)) - Number(licensed.includes(a)) || a.localeCompare(b));
  const v = (r: number) => pct(r).replace("%", "");
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Taxes & insurance defaults" subtitle="Rough planning defaults used when the property provider or the investor doesn't supply a number. Annual % of value. Override any state; leave blank to use the default." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper"><tr><th className="px-4 py-2 text-left text-xs text-muted">State</th><th className="px-2 text-xs text-muted">Tax % (default)</th><th className="px-2 text-xs text-muted">Insurance % (default)</th></tr></thead>
            <tbody className="divide-y divide-line">
              {ordered.map((s) => (
                <tr key={s} className={licensed.includes(s) ? "bg-accent-faint" : ""}>
                  <td className="px-4 py-1.5">{STATE_NAMES[s]} {licensed.includes(s) && <span className="text-xs text-accent">· licensed</span>}</td>
                  <td className="px-2 py-1"><Input name={`tax_${s}`} defaultValue={overrides[s] ? v(overrides[s]!.taxRatio) : ""} placeholder={v(STATE_DEFAULTS[s].taxRatio)} className="h-8 w-24" aria-label={`${s} tax`} /></td>
                  <td className="px-2 py-1"><Input name={`ins_${s}`} defaultValue={overrides[s] ? v(overrides[s]!.insuranceRatio) : ""} placeholder={v(STATE_DEFAULTS[s].insuranceRatio)} className="h-8 w-24" aria-label={`${s} insurance`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">{state.ok && <span className="text-sm text-good">Saved ✓</span>}<Button disabled={pending}>Save overrides</Button></div>
      </Card>
    </form>
  );
}
