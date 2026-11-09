"use client";

import { useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { importLoans, type ImportResult } from "@/lib/actions/moneylist";
import { autoMap, LOAN_FIELDS, type ColumnMapping } from "@/lib/moneylist/csv";
import { Badge, Button, Card, CardHeader, Notice, Select, Td, Th, buttonClass, cx } from "@/components/ui";

export function ImportWizard() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  async function onFile(f: File | undefined) {
    setResult(null);
    setReadError(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setReadError("Please upload a .csv file (export your loans from your LOS or spreadsheet as CSV).");
    if (f.size > 2_000_000) return setReadError("File is too large (max 2 MB).");
    const text = await f.text();
    const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    const hs = parsed.meta.fields ?? [];
    if (hs.length < 3) return setReadError("We couldn't find a header row. The first line should contain column names.");
    setFile({ name: f.name, text });
    setHeaders(hs);
    setPreview(parsed.data.slice(0, 3));
    setMapping(autoMap(hs));
  }

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      setResult(await importLoans(file.text, mapping, file.name, dryRun));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">1. Upload your closed loans</div>
            <p className="text-sm text-muted">CSV with one row per closed DSCR loan. Re-uploading the same loans updates them instead of duplicating.</p>
          </div>
          <a href="/api/money-list/template" className={buttonClass("secondary", "sm")}>Download CSV template</a>
        </div>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-paper/60 px-4 py-8 text-center hover:border-accent">
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="csv-input" />
          <span className="font-medium text-ink">{file ? file.name : "Choose a CSV file"}</span>
          <span className="mt-1 text-xs text-muted">{file ? `${headers.length} columns detected` : "or drop it here"}</span>
        </label>
        {readError && <div className="mt-3"><Notice tone="bad">{readError}</Notice></div>}
      </Card>

      {file && (
        <Card>
          <CardHeader title="2. Match your columns" subtitle="We guessed based on your headers. Required fields are marked." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {LOAN_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="w-40 shrink-0 font-medium text-ink-2">{f.label}{f.required && <span className="text-bad"> *</span>}</span>
                <Select value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))} className={cx("h-10", f.required && !mapping[f.key] && "border-bad")} aria-label={f.label}>
                  <option value="">— not in file —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </label>
            ))}
          </div>
          {preview.length > 0 && (
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-xs">
                <thead className="bg-paper"><tr>{LOAN_FIELDS.filter((f) => mapping[f.key]).map((f) => <Th key={f.key}>{f.label}</Th>)}</tr></thead>
                <tbody>{preview.map((r, i) => <tr key={i} className="border-t border-line">{LOAN_FIELDS.filter((f) => mapping[f.key]).map((f) => <Td key={f.key} className="whitespace-nowrap text-xs">{r[mapping[f.key]!]}</Td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-line p-4">
            <Button variant="secondary" onClick={() => run(true)} disabled={busy}>Validate</Button>
            <Button onClick={() => run(false)} disabled={busy}>{busy ? "Working…" : "Import loans"}</Button>
          </div>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader
            title={result.imported != null ? "Import complete" : result.errors.length ? `${result.errors.length} problem${result.errors.length === 1 ? "" : "s"} to fix` : "Looks good"}
            subtitle={result.message ?? `${result.validCount} of ${result.total} rows are valid.`}
            action={result.imported != null ? <Link href="/dashboard/money-list" className={buttonClass("accent", "sm")}>View Money List →</Link> : undefined}
          />
          {result.imported != null && <div className="p-5"><Notice tone="good">Imported {result.imported} new loan{result.imported === 1 ? "" : "s"}{result.updated ? ` and updated ${result.updated}` : ""}.</Notice></div>}
          {result.errors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-paper"><tr><Th>Row</Th><Th>Field</Th><Th>Value</Th><Th>What to fix</Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {result.errors.map((e, i) => (
                    <tr key={i}><Td className="num">{e.row || "—"}</Td><Td><Badge tone="bad">{e.field}</Badge></Td><Td className="font-mono text-xs">{e.value || <span className="text-muted">(empty)</span>}</Td><Td>{e.message}</Td></tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line px-5 py-3 text-xs text-muted">Nothing was imported. Fix these rows in your spreadsheet (or remove them) and upload again.</p>
            </div>
          )}
          {result.imported == null && result.errors.length === 0 && result.ok && <div className="p-5"><Button onClick={() => run(false)} disabled={busy}>Import {result.validCount} loans</Button></div>}
        </Card>
      )}
    </div>
  );
}
