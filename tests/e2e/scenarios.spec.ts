import { expect, test } from "@playwright/test";
import { hydrated, prisma, resetRateLimits, signInAs } from "./helpers";
import { startWebhookSink } from "./webhook-sink";

test.beforeEach(resetRateLimits);

test("Module 2: build 3 options → share → investor opens (LO notified) → details → picks B with a question → reopen after 24h → PDF → revoke/expire", async ({ page, browser }, info) => {
  const sink = await startWebhookSink(info.project.name === "mobile" ? 4592 : 4593);
  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: sink.url } });
  const tag = `${info.project.name}${Date.now()}`;
  const investorEmail = `investor.${tag}@example.test`;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await signInAs(page, "maya@harborline.example");
  await page.goto("/dashboard/scenarios/new");
  await hydrated(page);
  await page.getByLabel("Name").fill("Scenario Tester");
  await page.getByLabel("Email").fill(investorEmail);
  await page.getByLabel("Property address").fill("77 Option Way, Austin, TX 78701");
  await expect(page.getByLabel("State")).toHaveValue("TX");
  await page.getByLabel("Purchase price").fill("400000");
  await page.getByLabel("Monthly rent").fill("3300");
  await page.getByRole("button", { name: "Build options" }).click();
  await expect(page.getByTestId("builder-options").getByText(/^Option [ABC]$/)).toHaveCount(3);
  await expect(page.getByTestId("builder-result-A")).toContainText("DSCR");
  await page.locator("#o1-rate").fill("7.5");
  await expect(page.getByTestId("builder-result-B")).toContainText("7.5%");
  await page.getByRole("button", { name: "Save scenario" }).click();
  await page.waitForURL(/\/dashboard\/scenarios\/(?!new)[^/]+$/);

  const s = await prisma.scenario.findFirstOrThrow({ where: { investorEmail }, include: { options: true } });
  expect(s.status).toBe("DRAFT");
  expect(s.options).toHaveLength(3);
  expect(s.options.find((o) => o.label === "B")!.rateMilli).toBe(7_500);
  expect(s.options.find((o) => o.label === "A")!.recommended).toBe(true);

  await hydrated(page);
  await page.getByRole("button", { name: "Share: copy link" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  expect((await prisma.scenario.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("SHARED");
  const url = (await page.getByTestId("scenario-url").textContent())!.replace(/^https?:\/\/[^/]+/, "");

  // Staff preview is not tracked.
  await page.goto(url);
  await expect(page.getByTestId("option-A")).toBeVisible();
  await page.waitForTimeout(800);
  expect(await prisma.scenarioView.count({ where: { scenarioId: s.id } })).toBe(0);

  // Investor opens it.
  const inv = await browser.newContext({ ...(info.project.use as object) });
  const ip = await inv.newPage();
  await ip.goto(url);
  await hydrated(ip);
  await expect(ip.getByTestId("scenario-address")).toHaveText("77 Option Way, Austin, TX 78701");
  await expect(ip.getByTestId("broker-footer")).toContainText("NMLS #1849302");
  await expect.poll(() => prisma.event.count({ where: { entityId: s.id, type: "scenario.opened" } }), { timeout: 15_000 }).toBe(1);
  await expect.poll(() => prisma.devEmail.count({ where: { to: "maya@harborline.example", subject: { contains: "just opened your scenario" }, createdAt: { gte: s.createdAt } } }), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => sink.received.find((r) => r.headers["x-dscr-event"] === "scenario.viewed" && r.body.data.scenarioId === s.id)?.body.data.firstView, { timeout: 15_000 }).toBe(true);

  await ip.getByTestId("option-B").getByRole("button", { name: "See details" }).click();
  await expect(ip.getByTestId("details-B")).toContainText("If you sell or refinance early");
  await expect.poll(() => prisma.event.count({ where: { entityId: s.id, type: "scenario.option_expanded" } }), { timeout: 10_000 }).toBe(1);

  await ip.getByRole("button", { name: "I'm interested in Option B" }).click();
  await ip.getByLabel(t_question).fill("Can we close by the 30th?");
  await ip.getByRole("button", { name: /^Send to Maya/ }).click();
  await expect(ip.getByTestId("picked-banner")).toContainText("You picked Option B");
  const after = await prisma.scenario.findUniqueOrThrow({ where: { id: s.id } });
  expect(after.interestQuestion).toBe("Can we close by the 30th?");
  expect(after.interestedOptionId).toBe(s.options.find((o) => o.label === "B")!.id);
  await expect.poll(() => sink.received.find((r) => r.headers["x-dscr-event"] === "scenario.option_interest" && r.body.data.scenarioId === s.id)?.body.data.option.label, { timeout: 15_000 }).toBe("B");
  await expect.poll(() => prisma.devEmail.count({ where: { to: "maya@harborline.example", subject: "Scenario Tester picked Option B" } }), { timeout: 15_000 }).toBeGreaterThan(0);

  const pdf = await ip.request.get(`${url}/pdf`.replace("/b/", "/api/public/"));
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await inv.close();

  // Reopen more than 24h after the last visit → "reopened" notification.
  await prisma.scenarioView.updateMany({ where: { scenarioId: s.id }, data: { lastSeenAt: new Date(Date.now() - 2 * 86_400_000) } });
  const inv2 = await browser.newContext({ ...(info.project.use as object) });
  const ip2 = await inv2.newPage();
  await ip2.goto(url);
  await expect.poll(() => prisma.event.count({ where: { entityId: s.id, type: "scenario.reopened" } }), { timeout: 15_000 }).toBe(1);

  // Dashboard shows engagement and the pick.
  await page.goto(`/dashboard/scenarios/${s.id}`);
  await expect(page.getByText("Scenario picked Option B")).toBeVisible();
  await expect(page.getByTestId("scenario-views").locator("li")).toHaveCount(2);

  // Expired and revoked links.
  await prisma.scenario.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await ip2.goto(url);
  await expect(ip2.getByTestId("scenario-unavailable")).toContainText("Pricing has expired");
  await prisma.scenario.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() + 86_400_000) } });
  await hydrated(page);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect.poll(async () => (await prisma.scenario.findUniqueOrThrow({ where: { id: s.id } })).revokedAt).not.toBeNull();
  await ip2.goto(url);
  await expect(ip2.getByTestId("scenario-unavailable")).toContainText("no longer available");
  expect((await ip2.request.get(`${url}/pdf`.replace("/b/", "/api/public/"))).status()).toBe(410);
  await inv2.close();
  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: null } });
  await sink.close();
});

const t_question = "Anything you'd like to ask? (optional)";
