import { expect, test } from "@playwright/test";
import { hydrated, prisma, resetRateLimits } from "./helpers";

test.beforeEach(resetRateLimits);
import { startWebhookSink } from "./webhook-sink";

test("Module 1: instant check → estimate, consent, lead, PDF email, webhook, event", async ({ page }, info) => {
  const sink = await startWebhookSink(info.project.name === "mobile" ? 4598 : 4599);
  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: sink.url } });
  const email = `e2e.${info.project.name}.${Date.now()}@example.test`;
  const phone = `(555) 01${String(Date.now()).slice(-1)}-${String(Date.now()).slice(-4)}`;

  await page.goto("/b/harborline/check?lo=theo&utm_source=instagram");
  await hydrated(page);
  await expect(page.getByTestId("broker-footer")).toContainText("NMLS #2140077"); // owning LO
  await expect(page.getByTestId("broker-footer")).toContainText("Company NMLS #2203117");
  await expect(page.getByTestId("disclaimer")).toContainText("Disclaimer v1");

  await page.getByLabel("Property address").fill("4410 Bayshore Ct, Tampa, FL 33611");
  await expect(page.getByLabel("State")).toHaveValue("FL");
  await page.getByLabel("Purchase price").fill("400000");
  await expect(page.getByText("Estimate", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/Monthly rent/).fill("2300");
  await expect(page.getByTestId("verdict")).toHaveText("Needs adjustment");
  await expect(page.getByTestId("what-to-change")).toContainText("Simplest path");

  await page.getByLabel(/Monthly rent/).fill("3900");
  await expect(page.getByTestId("verdict")).toHaveText("Looks strong");

  await page.getByLabel("Full name").fill("Test Investor");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile phone").fill(phone);
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Email me the PDF estimate" }).click();
  await expect(page.getByText("DSCR loans are for investment properties only")).toBeVisible();
  await page.locator('input[name="investmentProperty"]').check();
  await page.locator('input[name="consentContact"]').check();
  await page.getByRole("button", { name: "Email me the PDF estimate" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  const lead = await prisma.lead.findFirstOrThrow({ where: { email }, include: { consents: true } });
  expect(lead.source).toBe("WIDGET");
  expect(lead.utmSource).toBe("instagram");
  expect(lead.consents.map((c) => c.kind).sort()).toEqual(["CONTACT", "INVESTMENT_PROPERTY", "MARKETING"]);
  expect(lead.consents.find((c) => c.kind === "CONTACT")?.granted).toBe(true);
  expect(lead.consents.find((c) => c.kind === "MARKETING")?.granted).toBe(false);
  expect(lead.disclaimerVersionId).toBeTruthy();
  const theo = await prisma.user.findUniqueOrThrow({ where: { email: "theo@harborline.example" } });
  expect(lead.ownerUserId).toBe(theo.id);

  await expect.poll(() => prisma.devEmail.count({ where: { to: email } }), { timeout: 30_000 }).toBe(1);
  expect((await prisma.devEmail.findFirstOrThrow({ where: { to: email } })).attachments).toContain(".pdf");
  await expect.poll(() => sink.received.some((r) => r.body?.data?.lead?.email === email), { timeout: 30_000 }).toBe(true);
  const hook = sink.received.find((r) => r.body?.data?.lead?.email === email)!;
  expect(hook.headers["x-dscr-event"]).toBe("lead.created");
  expect(String(hook.headers["x-dscr-signature"])).toMatch(/^sha256=[0-9a-f]{64}$/);
  expect(await prisma.event.count({ where: { entityId: lead.id, type: "lead.created" } })).toBe(1);

  // Resubmitting the same email dedupes into the same lead.
  await page.reload();
  await hydrated(page);
  await page.getByLabel("Property address").fill("4410 Bayshore Ct, Tampa, FL 33611");
  await page.getByLabel("Purchase price").fill("410000");
  await page.getByLabel(/Monthly rent/).fill("3900");
  await page.getByLabel("Full name").fill("Test Investor");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator('input[name="investmentProperty"]').check();
  await page.locator('input[name="consentContact"]').check();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Email me the PDF estimate" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  expect(await prisma.lead.count({ where: { email } })).toBe(1);
  expect((await prisma.lead.findFirstOrThrow({ where: { email } })).submissions).toBe(2);

  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: null } });
  await sink.close();
});

test("Module 1: cash-out mode, embed script, no-JS GET fallback", async ({ page, request, browser }) => {
  await page.goto("/b/cactus-ridge/check");
  await hydrated(page);
  await page.getByRole("radio", { name: "Cash-out refi" }).click();
  await page.getByLabel("State").selectOption("AZ");
  await page.getByLabel("Estimated value").fill("500000");
  await page.getByLabel("Current loan balance").fill("250000");
  await page.getByLabel("Cash out you want").fill("100000");
  await page.getByLabel(/Monthly rent/).fill("4000");
  await expect(page.getByTestId("verdict")).toBeVisible();
  await expect(page.getByTestId("cash-needed")).toHaveText("$100,000");

  const js = await request.get("/embed.js");
  expect(await js.text()).toContain("data-broker");

  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await ctx.newPage();
  await nojs.goto("/b/harborline/check?mode=PURCHASE&state=TX&propertyType=SFR&fico=740%2B&price=400,000&downPct=25&rent=3,200&taxesAnnual=4,800&insuranceAnnual=2,400");
  await expect(nojs.getByTestId("dscr-value")).toHaveText("1.22");
  await expect(nojs.getByTestId("verdict")).toHaveText("Looks strong");
  await ctx.close();
});
