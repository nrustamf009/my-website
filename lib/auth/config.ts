import NextAuth, { type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getMailer } from "@/lib/providers/email";

export type Role = "AGENCY_ADMIN" | "BROKER_ADMIN" | "LO";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null; role: Role; brokerId: string | null; agencyId: string | null };
  }
}

import { demoLoginEnabled } from "./demo";
export { demoLoginEnabled };

async function magicLinkHtml(url: string) {
  const { render } = await import("@react-email/components");
  const { PlatformEmail } = await import("@design/email/components");
  return render(
    PlatformEmail({
      heading: "Sign in to DSCR Investor Toolkit",
      paragraphs: ["Click the button below to sign in. This link expires in 24 hours and can be used once.", "If you didn't request this, you can ignore this email."],
      cta: { label: "Sign in", url },
    }),
  );
}

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  secret: env.authSecret,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
  providers: [
    Resend({
      apiKey: env.resendKey ?? "unused-in-dev",
      from: env.emailFrom,
      maxAge: 24 * 3600,
      async sendVerificationRequest({ identifier, url }) {
        await getMailer().send({
          to: identifier,
          subject: "Your sign-in link for DSCR Investor Toolkit",
          html: await magicLinkHtml(url),
          text: `Sign in to DSCR Investor Toolkit: ${url}\n\nThis link expires in 24 hours.`,
        });
      },
    }),
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: { email: { type: "email" } },
      async authorize(creds) {
        if (!demoLoginEnabled()) return null;
        const email = String(creds?.email ?? "").toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        return user ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
  callbacks: {
    /** Only pre-provisioned users (created by the agency admin or the seed) can sign in. */
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const existing = await prisma.user.findUnique({ where: { email } });
      return existing ? true : "/login?error=AccessDenied";
    },
    async jwt({ token, user }) {
      if (user?.email || (token.email && !token.role)) {
        const dbUser = await prisma.user.findUnique({ where: { email: (user?.email ?? token.email)!.toLowerCase() } });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.brokerId = dbUser.brokerId;
          token.agencyId = dbUser.agencyId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = (token.role as Role) ?? "LO";
      session.user.brokerId = (token.brokerId as string | null) ?? null;
      session.user.agencyId = (token.agencyId as string | null) ?? null;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
