import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, licensedStates, notificationEmails } from "@/lib/broker";
import { paletteVars } from "@/lib/brand/palette";
import { finishOnboarding } from "@/lib/actions/settings";
import { ProductMark } from "@/components/brand/Logo";
import { Button, Card, cx } from "@/components/ui";
import { BrandingForm, LicensingForm, NotificationsForm, ProgramForm, WebhookForm } from "@/components/settings/forms";
import { EmbedPanel } from "@/components/settings/EmbedPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup" };

const STEPS = ["Branding", "NMLS & licenses", "Program defaults", "Notifications", "CRM webhook", "Share & embed"];

export default async function Onboarding({ params }: { params: Promise<{ step: string }> }) {
  const n = Number((await params).step);
  if (!Number.isInteger(n) || n < 1 || n > 6) notFound();
  const { broker, user } = await requireBroker({ manage: true, onboarding: true });
  return (
    <div className="min-h-screen bg-paper" style={paletteVars(broker.accentColor) as React.CSSProperties}>
      <header className="flex items-center justify-between px-5 py-4"><ProductMark /><Link href="/dashboard" className="text-sm text-muted hover:text-ink">Skip for now</Link></header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Setup · about 10 minutes</p>
        <h1 className="mt-2 font-display text-3xl">Let&apos;s get {broker.companyName} live</h1>
        <ol className="my-6 flex gap-1 overflow-x-auto" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-24 flex-1">
              <Link href={`/onboarding/${i + 1}`} className="block">
                <div className={cx("h-1.5 rounded-full", i + 1 <= n ? "bg-accent" : "bg-line")} />
                <div className={cx("mt-1.5 text-xs", i + 1 === n ? "font-semibold text-ink" : "text-muted")}>{i + 1}. {s}</div>
              </Link>
            </li>
          ))}
        </ol>
        {n === 1 && <BrandingForm broker={broker} step={1} />}
        {n === 2 && <LicensingForm broker={broker} user={user} states={licensedStates(broker)} step={2} />}
        {n === 3 && <ProgramForm grid={engineContext(broker).grid} step={3} />}
        {n === 4 && <NotificationsForm broker={broker} emails={notificationEmails(broker)} step={4} />}
        {n === 5 && <WebhookForm broker={broker} step={5} />}
        {n === 6 && (
          <div className="space-y-4">
            <EmbedPanel slug={broker.slug} loSlug={user?.slug} />
            <Card className="flex items-center justify-between gap-4 p-5">
              <p className="text-sm text-ink-2">That&apos;s it. Your Instant Check, Scenario Sheets and Money List are ready.</p>
              <form action={finishOnboarding}><input type="hidden" name="_step" value={6} /><Button size="lg">Finish setup</Button></form>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
