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
  await expect(page.getByText("Evergreen Key Capital").first()).toBeVisible();
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
