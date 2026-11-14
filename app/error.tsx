"use client";

import { useEffect } from "react";

/** Any page error shows this instead of a blank "Application error" screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-5 py-16">
      <div className="max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink">This page could not load</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          The server could not finish this request. If this is a new deployment, check that the database connection is set and the demo data is loaded.
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
        <div className="mt-6 flex gap-3">
          <button onClick={reset} className="bg-inverse px-4 py-2 text-sm font-medium text-on-inverse focus-accent">Try again</button>
          <a href="/" className="border border-line px-4 py-2 text-sm font-medium text-ink focus-accent">All modules</a>
        </div>
      </div>
    </main>
  );
}
