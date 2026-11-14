import { expect, test } from "@playwright/test";

/** Demo without sign-in: the home page picks a broker and opens every module directly. */
const BROKERS = [
  { slug: "harborline", theme: "maison" },
  { slug: "cactus-ridge", theme: "terminal" },
  { slug: "evergreen-key", theme: "atelier" },
];
const MODULES = [
  { n: 1, url: /\/b\/[a-z-]+\/check/ },
  { n: 2, url: /\/dashboard\/scenarios/ },
  { n: 3, url: /\/dashboard\/money-list/ },
  { n: 4, url: /\/dashboard\/snapshots/ },
  { n: 5, url: /\/dashboard\/notes/ },
];

for (const b of BROKERS) {
  test(`demo: every module opens without sign-in (${b.theme})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/?b=${b.slug}`);
    await expect(page.getByRole("link", { name: /Sign in/ })).toHaveCount(0);
    for (const m of MODULES) {
      await page.goto(`/?b=${b.slug}`);
      await page.getByRole("link", { name: `Open module ${m.n} →` }).click();
      await page.waitForURL(m.url, { timeout: 30_000 });
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole("navigation", { name: "Demo" })).toBeVisible();
      await expect(page.locator(`main [data-theme="${b.theme}"], [data-theme="${b.theme}"]`).first()).toBeAttached();
    }
    expect(errors).toEqual([]);
  });
}

test("demo bar switches broker and keeps the module", async ({ page }) => {
  await page.goto("/go?as=harborline&to=%2Fdashboard%2Fmoney-list");
  await page.waitForURL(/\/dashboard\/money-list/);
  const bar = page.getByRole("navigation", { name: "Demo" });
  await bar.getByRole("link", { name: "terminal" }).click();
  await page.waitForURL(/\/dashboard\/money-list/);
  await expect(page.locator('[data-theme="terminal"]').first()).toBeAttached();
  await bar.getByRole("link", { name: /^2/ }).click();
  await page.waitForURL(/\/dashboard\/scenarios/);
});

test("/login goes straight to the module picker in demo", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$|\/\?/);
  await expect(page.getByRole("link", { name: "Open module 1 →" })).toBeVisible();
});
