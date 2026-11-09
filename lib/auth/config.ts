import NextAuth, { type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getMailer } from "@/lib/providers/email";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null; role: "AGENCY_ADMIN" | "BROKER"; brokerId: string | null; agencyId: string | null };
  }
}

/** Demo one-click login: on in development, or when DEMO_LOGIN=true. */
export function demoLoginEnabled() {
  return process.env.DEMO_LOGIN === "true" || process.env.NODE_ENV !== "production";
}

function magicLinkHtml(url: string) {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f4;padding:32px">
<table width="100%"><tr><td align="center"><table style="max-width:480px;background:#fff;border-radius:14px;padding:32px">
<tr><td><h1 style="font-size:20px;margin:0 0 12px;color:#1c1917">Sign in to DSCR Investor Toolkit</h1>
<p style="color:#44403c;font-size:15px;line-height:1.5">Click the button below to sign in. This link expires in 24 hours and can be used once.</p>
<p style="margin:24px 0"><a href="${url}" style="background:#1c1917;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p>
<p style="color:#78716c;font-size:12px">If you didn't request this, you can ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
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
          html: magicLinkHtml(url),
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
      session.user.role = (token.role as "AGENCY_ADMIN" | "BROKER") ?? "BROKER";
      session.user.brokerId = (token.brokerId as string | null) ?? null;
      session.user.agencyId = (token.agencyId as string | null) ?? null;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
