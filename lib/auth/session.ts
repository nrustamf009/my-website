import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacSha256, safeEqual } from "@/lib/tokens";
import { auth } from "./config";

export const IMPERSONATE_COOKIE = "dscr_impersonate";

export function signImpersonation(brokerId: string) {
  return `${brokerId}.${hmacSha256(env.authSecret, `impersonate:${brokerId}`)}`;
}

function verifyImpersonation(value: string | undefined): string | null {
  if (!value) return null;
  const [id, sig] = value.split(".");
  if (!id || !sig) return null;
  return safeEqual(sig, hmacSha256(env.authSecret, `impersonate:${id}`)) ? id : null;
}

export async function getSession() {
  return auth();
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AGENCY_ADMIN" || !session.user.agencyId) redirect("/dashboard");
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: session.user.agencyId } });
  return { session, agency };
}

/**
 * Resolve the broker tenant for the current request.
 * Brokers get their own tenant; agency admins get the broker they are impersonating.
 */
export async function requireBroker() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  let brokerId: string | null = null;
  let impersonating = false;
  if (session.user.role === "AGENCY_ADMIN") {
    const jar = await cookies();
    brokerId = verifyImpersonation(jar.get(IMPERSONATE_COOKIE)?.value);
    if (!brokerId) redirect("/admin");
    impersonating = true;
  } else {
    brokerId = session.user.brokerId;
  }
  if (!brokerId) redirect("/login?error=NoBroker");
  const broker = await prisma.broker.findUnique({ where: { id: brokerId } });
  if (!broker) redirect("/login?error=NoBroker");
  if (impersonating && broker.agencyId !== session.user.agencyId) redirect("/admin");
  return { session, broker, impersonating };
}
