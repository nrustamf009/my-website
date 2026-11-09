import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAs } from "./helpers";

const prisma = new PrismaClient();

test("Module 2: build scenario, investor opens it, broker notified, interest captured", async ({ page, browser }) => {
  await signInAs(page, "daniel@cactusridge.example");
  await page.goto("/dashboard/scenarios/new");
  const investor = `Riley E2E ${Date.now() % 100000}`;
  await page.getByLabel("Investor name").fill(investor);
  await page.getByLabel("Investor email").fill("riley.e2e@example.test");
  await page.getByLabel("Property address").fill("77 Ocotillo Ln, Mesa, AZ 85212");
  await page.getByLabel("Purchase price").fill("400000");
  await page.getByLabel("Monthly rent").fill("3000");
  await page.getByRole("button", { name: "+ Add option C" }).click();
  await expect(page.getByText("Option C")).toBeVisible();
  // Mark Option B as the broker's recommendation.
  await page.getByRole("button", { name: "☆ Recommend" }).nth(1).click();
  await expect(page.getByRole("button", { name: "★ My pick" })).toHaveCount(1);
  await page.getByRole("button", { name: "Save & get share link" }).click();
  await expect(page).toHaveURL(/\/dashboard\/scenarios\/.+\?shared=1/);

  const sc = await prisma.scenario.findFirstOrThrow({ where: { investorName: investor }, include: { options: true, broker: true } });
  expect(sc.options).toHaveLength(3);
  expect(sc.status).toBe("SHARED");
  expect(sc.options.filter((o) => o.recommended).map((o) => o.label)).toEqual(["B"]);

  // Broker preview is not tracked.
  await page.goto(`/b/${sc.broker.slug}/s/${sc.token}`);
  await expect(page.getByTestId("option-card")).toHaveCount(3);
  await expect(page.getByText("Recommends Option B")).toBeVisible();
  await expect(page.getByTestId("compare-table").locator("[data-best]")).not.toHaveCount(0);
  await expect(page.getByText(/Pays for itself in about \d+ months/)).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await prisma.scenarioView.count({ where: { scenarioId: sc.id } })).toBe(0);

  // Investor opens it on a phone.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone) Mobile" });
  const phone = await ctx.newPage();
  await phone.goto(`/b/${sc.broker.slug}/s/${sc.token}`);
  await expect(phone.getByText(`Loan options for ${investor}`, { exact: false })).toBeVisible();
  await expect(phone.getByText("NMLS #977415").first()).toBeVisible();
  await expect.poll(() => prisma.scenarioView.count({ where: { scenarioId: sc.id } })).toBe(1);
  await expect.poll(() => prisma.devEmail.count({ where: { subject: `${investor} is viewing your scenario now` } })).toBe(1);

  // Reload in the same tab: same visit, no new notification.
  await phone.reload();
  await phone.waitForTimeout(800);
  expect(await prisma.scenarioView.count({ where: { scenarioId: sc.id } })).toBe(1);

  // Simulate a return 25 hours later: age the previous visit, open in a new tab.
  await prisma.scenarioView.updateMany({ where: { scenarioId: sc.id }, data: { lastSeenAt: new Date(Date.now() - 25 * 3600_000) } });
  await prisma.scenario.update({ where: { id: sc.id }, data: { lastNotifiedAt: new Date(Date.now() - 25 * 3600_000) } });
  const tab2 = await ctx.newPage();
  await tab2.goto(`/b/${sc.broker.slug}/s/${sc.token}`);
  await expect.poll(() => prisma.devEmail.count({ where: { subject: `${investor} is viewing your scenario now` } })).toBe(2);

  // Phone shows one option at a time; the recommended option (B) opens first.
  await expect(tab2.getByRole("tab", { name: /Option B/ })).toHaveAttribute("aria-selected", "true");
  await tab2.getByRole("button", { name: "I'm interested in Option B" }).click();
  await expect(tab2.getByText("You picked Option B")).toBeVisible();
  await expect(tab2.getByRole("link", { name: "Text" })).toHaveAttribute("href", /^sms:/);
  await expect.poll(async () => (await prisma.scenario.findUnique({ where: { id: sc.id } }))?.interestedOptionId).toBe(sc.options.find((o) => o.label === "B")!.id);
  await expect.poll(() => prisma.devEmail.count({ where: { subject: `${investor} is interested in Option B` } })).toBe(1);

  const pdf = await tab2.request.get(`/b/${sc.broker.slug}/s/${sc.token}/pdf`);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // The investor can change their mind.
  await tab2.getByRole("tab", { name: /Option C/ }).click();
  await tab2.getByRole("button", { name: "Switch to Option C" }).click();
  await expect(tab2.getByText("You picked Option C")).toBeVisible();
  await expect.poll(async () => (await prisma.scenario.findUnique({ where: { id: sc.id } }))?.interestedOptionId).toBe(sc.options.find((o) => o.label === "C")!.id);

  await page.goto(`/dashboard/scenarios/${sc.id}`);
  await expect(page.getByText(`${investor} picked Option C`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Text link" })).toHaveAttribute("href", /^sms:/);

  // Duplicate creates an editable draft copy.
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  expect(await prisma.scenario.count({ where: { investorName: investor } })).toBe(2);
  await ctx.close();
});
