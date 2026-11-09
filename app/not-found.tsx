import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grain flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <div className="font-display text-7xl text-line">404</div>
        <h1 className="mt-2 font-display text-2xl">This page isn't available</h1>
        <p className="mt-2 text-sm text-muted">The link may have expired or been mistyped.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-ink underline">Go home</Link>
      </div>
    </main>
  );
}
