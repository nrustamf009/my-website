import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("magic link sign-in via dev mailbox", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("priya@evergreenkey.example");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page).toHaveURL(/check-email/);
  await page.goto("/dev/mailbox");
  const frame = page.frameLocator("iframe");
  const href = await frame.getByRole("link", { name: "Sign in" }).getAttribute("href");
  expect(href).toContain("/api/auth/callback/resend");
  await page.goto(href!);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Evergreen Key Capital").filter({ visible: true }).first()).toBeVisible();
});

test("unknown email is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("stranger@nowhere.example");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("isn't registered")).toBeVisible();
});

test("agency admin sees stats and can impersonate a broker", async ({ page }) => {
  await signInAs(page, "admin@northbeam.example");
  await expect(page.getByRole("heading", { name: "Agency overview" })).toBeVisible();
  await expect(page.getByText("Cactus Ridge Mortgage").first()).toBeVisible();
  const row = page.locator("tr", { hasText: "Cactus Ridge Mortgage" });
  await row.getByRole("button", { name: "Impersonate →" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Viewing as")).toBeVisible();
  await page.getByRole("button", { name: "Stop impersonating" }).click();
  await expect(page).toHaveURL(/\/admin/);
});

test("broker cannot open the admin panel", async ({ page }) => {
  await signInAs(page, "maya@harborline.example");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("broker dashboard on a phone: menu opens, navigates, signs out", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await signInAs(page, "maya@harborline.example");
  // No sideways scrolling anywhere on the overview.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("navigation").filter({ visible: true }).getByRole("link", { name: "Money List" }).click();
  await expect(page).toHaveURL(/money-list/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Menu" })).toContainText("Money List");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await ctx.close();
});
