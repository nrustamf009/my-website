"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { addLoan, commitImport, previewImport, type AddLoanState, type ImportPreview } from "@/lib/actions/moneylist";
import { LOAN_FIELDS, type ColumnMapping, type LoanFieldKey } from "@/lib/moneylist/csv";
import { rate, shortDate, usd } from "@/lib/format";
import { Button, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";

export function ImportWizard() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (text: string, name: string) => {
    setCsv(text);
    setFileName(name);
    setResult(null);
    start(async () => {
      const p = await previewImport(text);
      setPreview(p);
      setMapping(p.mapping);
      setError(p.ok ? null : (p.error ?? "Could not read the file"));
    });
  };
  const remap = (k: LoanFieldKey, v: string) => {
    const next = { ...mapping, [k]: v || undefined };
    setMapping(next);
    if (csv) start(async () => setPreview(await previewImport(csv, next)));
  };

  if (result) {
    return (
      <Notice tone="good">
        <div data-testid="import-result">
          Imported: <b>{result.created}</b> new, <b>{result.updated}</b> updated{result.skipped ? <>, <b>{result.skipped}</b> rows skipped with errors</> : null}.{" "}
          <Link href="/dashboard/money-list" className="font-medium underline">Open the Money List →</Link>
        </div>
      </Notice>
    );
  }

  return (
    <div className="space-y-5">
      <label
        className={cx("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-white/60 px-6 py-10 text-center transition hover:border-accent/50", pending && "opacity-60")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) load(await f.text(), f.name);
        }}
      >
        <span className="font-display text-xl text-ink">{fileName || "Drop your closed-loans CSV here"}</span>
        <span className="mt-1 text-sm text-muted">or click to choose a file · up to 5,000 rows · nothing is saved until you confirm</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          data-testid="csv-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) load(await f.text(), f.name);
          }}
        />
      </label>
      {error && <Notice tone="bad">{error}</Notice>}

      {preview?.ok && (
        <>
          <section>
            <h2 className="mb-2 font-display text-xl">1. Match your columns</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LOAN_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`} htmlFor={`map-${f.key}`}>
                  <Select id={`map-${f.key}`} value={mapping[f.key] ?? ""} onChange={(e) => remap(f.key, e.target.value)}>
                    <option value="">{f.required ? "Choose a column…" : "Not in file"}</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl">2. Check the results</h2>
            <div className="flex flex-wrap gap-2 text-sm" data-testid="import-summary">
              <span className="rounded-full bg-good-soft px-3 py-1 text-good">{preview.validCount} ready</span>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-deep">{preview.newCount} new · {preview.updateCount} will update</span>
              {preview.errorCount > 0 && <span className="rounded-full bg-bad-soft px-3 py-1 text-bad">{preview.errorCount} problem{preview.errorCount === 1 ? "" : "s"}</span>}
            </div>
            {preview.errors.length > 0 && (
              <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-bad/20 bg-white">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bad-soft text-left text-xs uppercase tracking-wider text-bad">
                    <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Field</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Fix</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.errors.map((e, i) => (
                      <tr key={i}><td className="num px-3 py-1.5">{e.row}</td><td className="px-3 py-1.5">{e.field}</td><td className="max-w-[10rem] truncate px-3 py-1.5 text-muted">{e.value || "(empty)"}</td><td className="px-3 py-1.5">{e.message}</td></tr>
                    ))}
                  </tbody>
                </table>
                {preview.errorCount > preview.errors.length && <p className="px-3 py-2 text-xs text-muted">Showing the first {preview.errors.length} of {preview.errorCount}.</p>}
              </div>
            )}
            {preview.sample.length > 0 && (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white text-sm">
                {preview.sample.map((s, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span className="font-medium">{s.borrowerName}</span>
                    <span className="text-muted">{s.propertyAddress}</span>
                    <span className="num">{usd(s.loanAmountCents)} · {rate(s.rateMilli)} · {s.product} · {s.prepayType} · {shortDate(s.closingDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex items-center gap-3">
            <Button
              variant="accent"
              size="lg"
              disabled={pending || !preview.validCount}
              data-testid="import-confirm"
              onClick={() =>
                start(async () => {
                  const r = await commitImport(csv!, mapping, fileName);
                  if (!r.ok) return setError(r.error ?? "Import failed");
                  setResult(r);
                })
              }
            >
              {pending ? "Working…" : `Import ${preview.validCount} loan${preview.validCount === 1 ? "" : "s"}`}
            </Button>
            {preview.errorCount > 0 && <span className="text-sm text-muted">Rows with problems are skipped. Fix them in your file and re-import any time; existing loans update in place.</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function PasteCsv() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) return <button className="text-sm text-accent underline" onClick={() => setOpen(true)}>Paste CSV text instead</button>;
  return (
    <div className="space-y-2">
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="borrower,email,property_address,loan_amount,…" />
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          const input = document.querySelector<HTMLInputElement>('[data-testid="csv-input"]');
          if (!input) return;
          const dt = new DataTransfer();
          dt.items.add(new File([text], "pasted.csv", { type: "text/csv" }));
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          setOpen(false);
        }}
      >
        Use this text
      </Button>
    </div>
  );
}

export function AddLoanForm() {
  const [state, action, pending] = useActionState<AddLoanState, FormData>(addLoan, {});
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <form action={action} className="space-y-4" key={state.ok ? Date.now() : "form"}>
      {state.ok && <Notice tone="good">Loan added. <Link href="/dashboard/money-list" className="underline">See the Money List →</Link></Notice>}
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Borrower name *" htmlFor="borrower" error={err("borrower")}><Input id="borrower" name="borrower" required /></Field>
        <Field label="Email" htmlFor="email" error={err("email")}><Input id="email" name="email" type="email" /></Field>
        <Field label="Phone" htmlFor="phone" error={err("phone")}><Input id="phone" name="phone" type="tel" /></Field>
        <Field label="Property address *" htmlFor="propertyAddress" error={err("propertyAddress")}><Input id="propertyAddress" name="propertyAddress" placeholder="118 Maple Ave, Austin, TX 78704" required /></Field>
        <Field label="Loan amount *" htmlFor="loanAmount" error={err("loanAmount")}><Input id="loanAmount" name="loanAmount" inputMode="decimal" placeholder="320,000" required /></Field>
        <Field label="Interest rate (%) *" htmlFor="rate" error={err("rate")}><Input id="rate" name="rate" inputMode="decimal" placeholder="7.875" required /></Field>
        <Field label="Closing date *" htmlFor="closingDate" error={err("closingDate")}><Input id="closingDate" name="closingDate" type="date" required /></Field>
        <Field label="Product" htmlFor="product" error={err("product")}>
          <Select id="product" name="product" defaultValue="fixed"><option value="fixed">30-year fixed</option><option value="interest only">Interest-only</option><option value="arm">ARM</option></Select>
        </Field>
        <Field label="ARM first reset" htmlFor="armResetDate" hint="ARMs only" error={err("armResetDate")}><Input id="armResetDate" name="armResetDate" type="date" /></Field>
        <Field label="Prepay type *" htmlFor="prepayType" error={err("prepayType")}>
          <Select id="prepayType" name="prepayType" defaultValue="5-4-3-2-1">
            {["5-4-3-2-1", "3-2-1", "5-5-5-5-5", "3-3-3", "2-1", "1", "none"].map((p) => <option key={p} value={p}>{p === "none" ? "None" : p}</option>)}
          </Select>
        </Field>
        <Field label="Value at closing" htmlFor="closingValue" hint="Purchase price or appraised value" error={err("closingValue")}><Input id="closingValue" name="closingValue" inputMode="decimal" /></Field>
        <Field label="LTV at closing (%)" htmlFor="ltv" error={err("ltv")}><Input id="ltv" name="ltv" inputMode="decimal" /></Field>
      </div>
      <Field label="Notes" htmlFor="notes"><Textarea id="notes" name="notes" rows={2} /></Field>
      <Button variant="primary" disabled={pending}>{pending ? "Adding…" : "Add loan"}</Button>
    </form>
  );
}
