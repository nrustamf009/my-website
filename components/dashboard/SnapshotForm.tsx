"use client";

import { useActionState, useState } from "react";
import type { Realtor } from "@prisma/client";
import { createSnapshot, type SnapshotFormState } from "@/lib/actions/snapshots";
import { Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { MoneyInput } from "@/components/public/MoneyInput";

export function SnapshotForm({ realtors, defaultRate }: { realtors: Realtor[]; defaultRate: number }) {
  const [state, action, pending] = useActionState<SnapshotFormState, FormData>(createSnapshot, {});
  const e = state.fieldErrors ?? {};
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [rent, setRent] = useState<number | null>(null);
  const [rentSource, setRentSource] = useState<"RENTCAST" | "MOCK" | "MANUAL">("MANUAL");
  const [lookup, setLookup] = useState<string | null>(null);
  const [realtorId, setRealtorId] = useState(realtors[0]?.id ?? "new");
  const [logo, setLogo] = useState("");
  const [logoError, setLogoError] = useState<string | null>(null);

  async function fetchRent() {
    setLookup("Looking up…");
    const qs = new URLSearchParams({ address, ...(price ? { price: String(price) } : {}) });
    const res = await fetch(`/api/rent-estimate?${qs}`);
    const data = await res.json();
    if (data.estimate) {
      setRent(data.estimate.rent);
      setRentSource(data.estimate.provider === "rentcast" ? "RENTCAST" : "MOCK");
      setLookup(`${data.estimate.provider === "rentcast" ? "RentCast" : "Mock"} estimate${data.estimate.rentLow ? ` (range $${data.estimate.rentLow.toLocaleString()}–$${data.estimate.rentHigh.toLocaleString()})` : ""}${data.estimate.cached ? " · cached" : ""}`);
    } else setLookup(data.error ?? "No estimate available. Enter rent manually.");
  }

  function onLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return setLogo("");
    if (!/image\/(png|jpeg)/.test(file.type)) return setLogoError("Use a PNG or JPG file.");
    if (file.size > 256 * 1024) return setLogoError("Logo must be under 256 KB.");
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(file);
  }

  return (
    <form action={action} className="space-y-6">
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <Card>
        <CardHeader title="Property" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Address" error={e.address}><Input name="address" value={address} onChange={(ev) => setAddress(ev.target.value)} placeholder="1820 Willow Bend Ln, Tampa, FL 33612" required /></Field>
          </div>
          <Field label="List price" error={e.price}>
            <MoneyInput value={price} onChange={setPrice} placeholder="425,000" />
            <input type="hidden" name="price" value={price ?? ""} />
          </Field>
          <Field label="Monthly rent" error={e.monthlyRent} hint={lookup ?? "Use an estimate or type the expected lease"}>
            <div className="flex gap-2">
              <MoneyInput value={rent} onChange={(v) => { setRent(v); setRentSource("MANUAL"); }} placeholder="2,800" className="flex-1" />
              <Button type="button" variant="secondary" className="h-12" onClick={fetchRent} disabled={address.length < 6}>Estimate</Button>
            </div>
            <input type="hidden" name="monthlyRent" value={rent ?? ""} />
            <input type="hidden" name="rentSource" value={rentSource} />
          </Field>
          <Field label="Rate for the snapshot (%)" error={e.ratePct}><Input name="ratePct" type="number" step="0.125" defaultValue={defaultRate} /></Field>
          <Field label="HOA per month" error={e.hoaMonthly}><Input name="hoaMonthly" type="number" min={0} defaultValue={0} /></Field>
          <Field label="Taxes per month (optional)" hint="Blank = estimated from your tax % setting" error={e.taxesMonthly}><Input name="taxesMonthly" type="number" min={0} /></Field>
          <Field label="Insurance per month (optional)" hint="Blank = estimated from your insurance % setting" error={e.insuranceMonthly}><Input name="insuranceMonthly" type="number" min={0} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Realtor" subtitle="Co-branded on the PDF. Leads from the QR code are tagged to this realtor." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Realtor">
              <Select name="realtorId" value={realtorId} onChange={(ev) => setRealtorId(ev.target.value)}>
                {realtors.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.brokerage}</option>)}
                <option value="new">+ Add a new realtor</option>
              </Select>
            </Field>
          </div>
          {realtorId === "new" && (
            <>
              <Field label="Realtor name" error={e.realtorName}><Input name="realtorName" /></Field>
              <Field label="Brokerage" error={e.realtorBrokerage}><Input name="realtorBrokerage" /></Field>
              <Field label="Email (optional)" error={e.realtorEmail}><Input name="realtorEmail" type="email" /></Field>
              <Field label="Phone (optional)"><Input name="realtorPhone" /></Field>
              <Field label="Brokerage logo (optional)" hint="PNG or JPG, under 256 KB" error={logoError ?? e.realtorLogo}>
                <input type="file" accept="image/png,image/jpeg" onChange={(ev) => onLogo(ev.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm" />
                <input type="hidden" name="realtorLogo" value={logo} />
              </Field>
            </>
          )}
        </div>
      </Card>
      <div className="flex justify-end"><Button size="lg" disabled={pending}>{pending ? "Creating…" : "Create snapshot"}</Button></div>
    </form>
  );
}
