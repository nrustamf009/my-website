import Link from "next/link";
import { ProductMark } from "@/components/brand/Logo";
import { Card, buttonClass } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata = { title: "Check your email" };

export default function CheckEmail() {
  const dev = !env.resendKey;
  return (
    <main className="grain flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <ProductMark className="mb-8" />
        <Card className="p-8">
          <h1 className="font-display text-2xl">Check your email</h1>
          <p className="mt-2 text-sm text-muted">A sign-in link is on its way. It expires in 24 hours.</p>
          {dev && (
            <div className="mt-6">
              <p className="mb-3 text-sm text-ink-2">Email is in mock mode (no Resend key), so the link is in the dev mailbox.</p>
              <Link href="/dev/mailbox" className={buttonClass("primary")}>Open dev mailbox</Link>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
