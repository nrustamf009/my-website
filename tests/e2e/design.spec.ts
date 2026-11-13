import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prisma, signInAs } from "./helpers";

const THEMES = [
  { theme: "maison", slug: "harborline", families: ["instrumentSerif", "hankenGrotesk"] },
  { theme: "terminal", slug: "cactus-ridge", families: ["plexSans", "plexMono"] },
  { theme: "atelier", slug: "evergreen-key", families: ["interTight"] },
] as const;
const themeOf = (p: import("@playwright/test").Page) => p.locator("main").first().evaluate((el) => (el.closest("[data-theme]") as HTMLElement | null)?.dataset.theme ?? null);
const ALL = ["instrumentSerif", "hankenGrotesk", "plexSans", "plexMono", "interTight"];

for (const { theme, slug, families } of THEMES) {
  test(`${theme}: only the theme's fonts load, and axe finds no serious issues on check, listing and scenario pages`, async ({ page }) => {
    await page.goto(`/b/${slug}/check?price=385000&rent=2950&state=OH`);
    await expect(page.getByTestId("dscr-value")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const loaded: string[] = await page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === "loaded").map((f) => f.family.replace(/['"]/g, "")));
    const used = ALL.filter((f) => loaded.some((l) => l === f));
    expect(used.length).toBeGreaterThan(0);
    for (const f of used) expect(families as readonly string[]).toContain(f);
    expect(await themeOf(page)).toBe(theme);

    const snap = await prisma.snapshot.findFirstOrThrow({ where: { broker: { slug } } });
    const scen = await prisma.scenario.findFirstOrThrow({ where: { broker: { slug }, status: "SHARED" } });
    for (const path of [`/b/${slug}/check?price=385000&rent=2950&state=OH`, `/b/${slug}/l/${snap.token}`, `/b/${slug}/s/${scen.token}`]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(bad, `${theme} ${path}`).toEqual([]);
    }
  });

  test(`${theme}: gallery visual snapshot (golden fixture)`, async ({ page }) => {
    await page.goto(`/dev/design?theme=${theme}`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId(`gallery-${theme}`)).toBeVisible();
    await expect(page).toHaveScreenshot(`gallery-${theme}.png`, { fullPage: true, maxDiffPixelRatio: 0.02 });
  });
}

test("Appearance: switching theme restyles public pages; preview params work only for the broker", async ({ page, browser }) => {
  await signInAs(page, "priya@evergreenkey.example");
  await page.goto("/dashboard/settings/appearance");
  await expect(page.getByTestId("appearance")).toBeVisible();
  await page.getByTestId("theme-terminal").click();
  await expect(page.getByTestId("contrast")).toContainText(":1");
  await expect(page.getByTestId("preview-frame")).toHaveAttribute("src", /previewTheme=terminal/);
  // Preview is honored for the broker's own user…
  await page.goto("/b/evergreen-key/check?previewTheme=terminal");
  expect(await themeOf(page)).toBe("terminal");
  // …but not for a public visitor.
  await prisma.broker.update({ where: { slug: "evergreen-key" }, data: { isDemo: false } });
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await ap.goto("/b/evergreen-key/check?previewTheme=terminal");
  expect(await themeOf(ap)).toBe("atelier");
  await prisma.broker.update({ where: { slug: "evergreen-key" }, data: { isDemo: true } });
  // Save the theme, then restore.
  await page.goto("/dashboard/settings/appearance");
  await page.getByTestId("theme-terminal").click();
  await page.getByRole("button", { name: "Save appearance" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  expect((await prisma.broker.findUniqueOrThrow({ where: { slug: "evergreen-key" } })).theme).toBe("terminal");
  await ap.goto("/b/evergreen-key/check");
  expect(await themeOf(ap)).toBe("terminal");
  await prisma.broker.update({ where: { slug: "evergreen-key" }, data: { theme: "atelier", accentColor: "#0B6B4F" } });
  await anon.close();
});
