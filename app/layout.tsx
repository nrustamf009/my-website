import type { Metadata, Viewport } from "next";
import { PLATFORM_THEME } from "@design";
import { ThemeScope } from "@design/ThemeScope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DSCR Investor Toolkit", template: "%s · DSCR Investor Toolkit" },
  description: "Lead capture, scenario sheets, and client re-engagement for DSCR mortgage brokers.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Platform pages (landing, sign-in) use the platform theme; broker and admin areas set their own ThemeScope. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ThemeScope theme={PLATFORM_THEME.id} accent={PLATFORM_THEME.accent}>
          {children}
        </ThemeScope>
      </body>
    </html>
  );
}
