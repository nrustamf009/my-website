"use client";

import { useEffect, useState } from "react";

type ServerError = { event?: string; error?: string; digest?: string | null; path?: string; stack?: string };

/** Any page error shows this instead of a blank "Application error" screen, with the cause when known. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [server, setServer] = useState<ServerError | null>(null);
  useEffect(() => {
    console.error(error);
    fetch("/api/health?errors=1")
      .then((r) => r.json())
      .then((d: { recentErrors?: ServerError[] }) => {
        const list = d.recentErrors ?? [];
        setServer(list.find((e) => error.digest && e.digest === error.digest) ?? list[0] ?? null);
      })
      .catch(() => {});
  }, [error]);
  const detail = server?.error ?? error.message;
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink">This page could not load</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">Something failed on the server. Try again, or go back to the modules.</p>
        <div className="mt-6 flex gap-3">
          <button onClick={reset} className="bg-inverse px-4 py-2 text-sm font-medium text-on-inverse focus-accent">Try again</button>
          <a href="/" className="border border-line px-4 py-2 text-sm font-medium text-ink focus-accent">All modules</a>
        </div>
        <details className="mt-8 text-xs text-muted" open>
          <summary className="cursor-pointer">Technical details</summary>
          <p className="mt-2 break-words font-mono">{detail || "No details"}</p>
          {server?.path && <p className="mt-1 break-words font-mono">{server.path}</p>}
          {server?.stack && <p className="mt-1 break-words font-mono">{server.stack}</p>}
          {error.digest && <p className="mt-1 font-mono">Ref {error.digest}</p>}
        </details>
      </div>
    </main>
  );
}
