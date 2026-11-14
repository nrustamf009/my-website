import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { ProductMark } from "@/components/brand/Logo";
import { Button, Card, Input, Label, Notice } from "@/components/ui";
import { auth, demoLoginEnabled, signIn } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied: "That email isn't registered. Ask your agency admin to add you.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  NoBroker: "Your account isn't linked to a broker profile yet.",
  CredentialsSignin: "Demo sign-in failed.",
};

async function emailSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  let errorCode: string | null = null;
  try {
    const result = await signIn("resend", { email, redirectTo: "/dashboard", redirect: false });
    if (typeof result === "string" && result.includes("error=")) errorCode = new URL(result, "http://x").searchParams.get("error");
  } catch (err) {
    if (!(err instanceof AuthError)) throw err;
    errorCode = err.type === "AccessDenied" ? "AccessDenied" : "Verification";
  }
  redirect(errorCode ? `/login?error=${errorCode}` : "/login/check-email");
}

async function demoSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  await signIn("demo", { email, redirectTo: user?.role === "AGENCY_ADMIN" ? "/admin" : "/dashboard" });
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user) redirect(session.user.role === "AGENCY_ADMIN" ? "/admin" : "/dashboard");
  // Demo has no sign-in: the home page is the module picker.
  if (demoLoginEnabled()) redirect("/");
  const { error } = await searchParams;
  const demo = demoLoginEnabled();
  const demoUsers = demo
    ? await prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }], include: { broker: { select: { companyName: true, accentColor: true } } }, take: 8 })
    : [];

  return (
    <main className="grain flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-block"><ProductMark /></Link>
        <Card className="p-6 sm:p-8">
          <h1 className="font-display text-2xl">Sign in</h1>
          <p className="mt-1 text-sm text-muted">We'll email you a one-time sign-in link. No password needed.</p>
          {error && <div className="mt-4"><Notice tone="bad">{ERRORS[error] ?? "Something went wrong. Please try again."}</Notice></div>}
          <form action={emailSignIn} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@yourcompany.com" />
            </div>
            <Button type="submit" className="w-full" size="lg">Email me a sign-in link</Button>
          </form>
        </Card>

        {demo && demoUsers.length > 0 && (
          <Card className="mt-4 p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Demo accounts · one-click sign in</div>
            <div className="mt-3 space-y-2">
              {demoUsers.map((u) => (
                <form key={u.id} action={demoSignIn}>
                  <input type="hidden" name="email" value={u.email} />
                  <button className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-sm transition hover:bg-paper">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-ink" style={u.broker?.accentColor ? { background: u.broker.accentColor } : undefined} />
                    <span className="flex-1">
                      <span className="block font-medium text-ink">{u.name ?? u.email}</span>
                      <span className="block text-xs text-muted">{u.role === "AGENCY_ADMIN" ? "Agency admin" : u.broker?.companyName} · {u.email}</span>
                    </span>
                    <span className="text-muted">→</span>
                  </button>
                </form>
              ))}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
