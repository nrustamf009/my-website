import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** One-click demo sign-in (demo mode is on in development and with DEMO_LOGIN=true). */
export async function signInAs(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("form", { has: page.locator(`input[value="${email}"]`) }).getByRole("button").click();
  await page.waitForURL(/\/(dashboard|admin|onboarding)/, { timeout: 30_000 });
}

/** Wait until client components are interactive (avoids clicking before hydration in dev). */
export async function hydrated(page: Page) {
  await page.waitForLoadState("networkidle");
}

/** Tests share one IP; clear the public-form rate limiter between specs. */
export async function resetRateLimits() {
  await prisma.rateLimitHit.deleteMany();
}
