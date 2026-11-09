"use client";

import { useState } from "react";
import { FICO_RANGES } from "@/lib/dscr";
import { pct } from "@/lib/format";
import { cx, Label, Select } from "@/components/ui";
import { LeadCaptureForm } from "./LeadCaptureForm";

export function ListingPrequal({ slug, token, address, price, monthlyRent, ratePct, hoaMonthly, brokerFirstName, brokerPhone }: { slug: string; token: string; address: string; price: number; monthlyRent: number; ratePct: number; hoaMonthly: number; brokerFirstName: string; brokerPhone?: string | null }) {
  const [down, setDown] = useState(0.25);
  const [fico, setFico] = useState("720-759");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Planned down payment</Label>
          <div className="flex gap-2">
            {[0.2, 0.25, 0.3].map((d) => (
              <button key={d} type="button" onClick={() => setDown(d)} className={cx("h-11 flex-1 rounded-lg border text-sm", down === d ? "border-accent bg-accent-soft font-semibold text-accent-deep" : "border-line bg-white")}>{pct(d)}</button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="lp-fico">Approximate credit score</Label>
          <Select id="lp-fico" value={fico} onChange={(e) => setFico(e.target.value)}>{FICO_RANGES.map((r) => <option key={r}>{r}</option>)}</Select>
        </div>
      </div>
      <LeadCaptureForm
        slug={slug}
        source="LISTING"
        snapshotToken={token}
        submitLabel="Get pre-qualified for this property"
        brokerFirstName={brokerFirstName}
        brokerPhone={brokerPhone}
        getDeal={() => ({ address, price, downPaymentPct: down, monthlyRent, fico, ratePct, hoaMonthly })}
      />
    </div>
  );
}
