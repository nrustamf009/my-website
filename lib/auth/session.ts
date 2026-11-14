import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, forBroker } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacSha256, safeEqual } from "@/lib/tokens";
import { auth, demoLoginEnabled, type Role } from "./config";
import { DEMO_AGENCY_EMAIL, DEMO_COOKIE, IMPERSONATE_COOKIE_NAME as IMPERSONATE_COOKIE, demoBroker } from "./demo";

export { IMPERSONATE_COOKIE_NAME as IMPERSONATE_COOKIE } from "./demo";

export function signImpersonation(brokerId: string) {
  return `${brokerId}.${hmacSha256(env.authSecret, `impersonate:${brokerId}`)}`;
}

export function verifyImpersonation(value: string | undefined): string | null {
  if (!value) return null;
  const [id, sig] = value.split(".");
  if (!id || !sig) return null;
  return safeEqual(sig, hmacSha256(env.authSecret, `impersonate:${id}`)) ? id : null;
}

/**
 * Demo: no sign-in. The visitor acts as the seeded account picked by the demo cookie
 * (a broker slug, "agency", or an account email), defaulting to the first demo broker.
 */
async function demoSession() {
  const as = (await cookies()).get(DEMO_COOKIE)?.value;
  const email = as?.includes("@") ? as : as === "agency" ? DEMO_AGENCY_EMAIL : demoBroker(as).email;
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return null;
  return { user: { id: u.id, email: u.email, name: u.name, role: u.role as Role, brokerId: u.brokerId, agencyId: u.agencyId } };
}

/**
 * Who is looking at a public page, for "staff are not tracked". In the demo, only a visitor who has
 * entered the dashboard (and so carries the demo cookie) counts as staff.
 */
export async function getStaffSession() {
  if (!demoLoginEnabled()) return auth();
  return (await cookies()).get(DEMO_COOKIE) ? demoSession() : null;
}

export async function getSession() {
  return demoLoginEnabled() ? demoSession() : auth();
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) redirect(demoLoginEnabled() ? "/" : "/login");
  if (session.user.role !== "AGENCY_ADMIN" || !session.user.agencyId) redirect("/dashboard");
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: session.user.agencyId } });
  return { session, agency };
}

/**
 * Resolve the broker tenant for this request and return a tenant-scoped db.
 * LOs and broker admins get their own broker; agency admins get the broker they impersonate.
 * `canManage` = broker admin or impersonating agency admin (settings, team, grid).
 */
export async function requireBroker(opts: { manage?: boolean; onboarding?: boolean } = {}) {
  const session = await getSession();
  if (!session?.user) redirect(demoLoginEnabled() ? "/" : "/login");
  let brokerId: string | null = null;
  let impersonating = false;
  if (session.user.role === "AGENCY_ADMIN") {
    brokerId = verifyImpersonation((await cookies()).get(IMPERSONATE_COOKIE)?.value);
    if (!brokerId) redirect("/admin");
    impersonating = true;
  } else brokerId = session.user.brokerId;
  if (!brokerId) redirect("/login?error=NoBroker");
  const broker = await prisma.broker.findUnique({ where: { id: brokerId } });
  if (!broker) redirect("/login?error=NoBroker");
  if (impersonating && broker.agencyId !== session.user.agencyId) redirect("/admin");
  const user = impersonating ? null : await prisma.user.findUnique({ where: { id: session.user.id } });
  const canManage = impersonating || user?.role === "BROKER_ADMIN";
  if (opts.manage && !canManage) redirect("/dashboard?error=forbidden");
  if (!opts.onboarding && !impersonating && canManage && broker.onboardingStep < 6) redirect(`/onboarding/${Math.max(1, broker.onboardingStep + 1)}`);
  return { session, broker, user, impersonating, canManage, db: forBroker(broker.id) };
}
