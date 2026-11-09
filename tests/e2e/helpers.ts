import type { Page } from "@playwright/test";

/** One-click demo sign-in (demo mode is on in development). */
export async function signInAs(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("form", { has: page.locator(`input[value="${email}"]`) }).getByRole("button").click();
  await page.waitForURL(/\/(dashboard|admin)/);
}
