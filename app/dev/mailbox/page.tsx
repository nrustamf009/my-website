import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { demoLoginEnabled } from "@/lib/auth/config";
import { relativeTime } from "@/lib/format";
import { ProductMark } from "@/components/brand/Logo";
import { cx } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev mailbox", robots: { index: false } };

/** Mock-mode inbox. Only available when Resend is not configured and demo mode is on. */
export default async function Mailbox({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (env.resendKey || !demoLoginEnabled()) notFound();
  const { id } = await searchParams;
  const emails = await prisma.devEmail.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const selected = emails.find((e) => e.id === id) ?? emails[0];
  const attachments: { filename: string; size: number; base64: string }[] = selected?.attachments ? JSON.parse(selected.attachments) : [];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-3">
        <div className="flex items-center gap-3"><ProductMark /><span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">Dev mailbox · mock email mode</span></div>
        <Link href="/login" className="text-sm text-muted hover:text-ink">Back to sign in</Link>
      </header>
      <div className="grid min-h-0 flex-1 md:grid-cols-[340px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r border-line bg-white">
          {emails.length === 0 && <p className="p-5 text-sm text-muted">No emails yet.</p>}
          {emails.map((e) => (
            <Link key={e.id} href={`/dev/mailbox?id=${e.id}`} className={cx("block border-b border-line px-4 py-3 hover:bg-paper", selected?.id === e.id && "bg-paper")}>
              <div className="flex justify-between gap-2 text-xs text-muted"><span className="truncate">To: {e.to}</span><span className="shrink-0">{relativeTime(e.createdAt)}</span></div>
              <div className="mt-0.5 truncate text-sm font-medium text-ink">{e.subject}</div>
              {e.attachments && <div className="mt-0.5 text-xs text-muted">📎 attachment</div>}
            </Link>
          ))}
        </aside>
        <section className="flex min-h-0 flex-col bg-paper">
          {selected ? (
            <>
              <div className="border-b border-line bg-white px-5 py-3">
                <div className="text-sm font-semibold">{selected.subject}</div>
                <div className="text-xs text-muted">To: {selected.to}</div>
                {attachments.map((a) => (
                  <a key={a.filename} download={a.filename} href={`data:application/pdf;base64,${a.base64}`} className="mt-2 mr-2 inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:bg-paper">
                    📎 {a.filename} ({Math.round(a.size / 1024)} KB)
                  </a>
                ))}
              </div>
              <iframe title="Email preview" srcDoc={selected.html} className="min-h-0 w-full flex-1 bg-white" sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" />
            </>
          ) : (
            <div className="p-10 text-sm text-muted">Select an email.</div>
          )}
        </section>
      </div>
    </div>
  );
}
