import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { startWebhookSink } from "./webhook-sink";

const prisma = new PrismaClient();

test("Module 1: instant check computes DSCR and captures a lead", async ({ page }, info) => {
  const sink = await startWebhookSink(info.project.name === "mobile" ? 4598 : 4599);
  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: sink.url } });
  const email = `e2e.${info.project.name}.${Date.now()}@example.test`;

  await page.goto("/b/harborline/check");
  await expect(page.getByRole("heading", { name: /qualify for a DSCR loan/ })).toBeVisible();
  await expect(page.getByText("NMLS #1849302").first()).toBeVisible();

  await page.getByLabel("Property address").fill("4410 Bayshore Ct, Tampa, FL 33611");
  await page.getByLabel("Purchase price").fill("400000");
  // Rent is prefilled by the (mock) estimate, then overridden manually.
  await expect(page.getByText("Estimated (demo data)")).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Expected monthly rent").fill("2300");
  await expect(page.getByTestId("dscr-value")).toBeVisible();
  const lowDscr = Number(await page.getByTestId("dscr-value").innerText());
  expect(lowDscr).toBeLessThan(1);
  await expect(page.getByText("What to change to qualify")).toBeVisible();

  await page.getByLabel("Expected monthly rent").fill("3600");
  await expect(page.getByTestId("verdict")).toHaveText("Likely qualifies");

  await page.getByLabel("Full name").fill("Test Investor");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile phone").fill("(555) 010-1234");
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Email me the full analysis" }).click();
  await expect(page.getByText("Please check the box")).toBeVisible();
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Email me the full analysis" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  const lead = await prisma.lead.findFirst({ where: { email }, include: { broker: true } });
  expect(lead?.source).toBe("CHECK");
  expect(lead?.broker.slug).toBe("harborline");
  expect(lead?.consentText).toContain("I agree to be contacted");

  await expect.poll(async () => prisma.devEmail.count({ where: { to: email } }), { timeout: 20_000 }).toBe(1);
  const investorEmail = await prisma.devEmail.findFirst({ where: { to: email } });
  expect(investorEmail?.attachments).toContain(".pdf");
  await expect.poll(async () => prisma.devEmail.count({ where: { subject: { contains: "Test Investor" } } })).toBeGreaterThan(0);
  await expect.poll(() => sink.received.find((r) => r.body?.data?.lead?.email === email) != null, { timeout: 20_000 }).toBe(true);
  const hook = sink.received.find((r) => r.body?.data?.lead?.email === email)!;
  expect(hook.headers["x-dscr-event"]).toBe("lead.created");
  expect(String(hook.headers["x-dscr-signature"])).toMatch(/^sha256=/);

  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: null } });
  await sink.close();
});

test("Module 1: embed script and iframe page", async ({ request, page }) => {
  const js = await request.get("/b/cactus-ridge/embed.js");
  expect(js.ok()).toBe(true);
  expect(await js.text()).toContain("/b/cactus-ridge/embed/check");
  await page.goto("/b/cactus-ridge/embed/check");
  await expect(page.getByLabel("Purchase price")).toBeVisible();
  await expect(page.getByText("NMLS #977415")).toBeVisible();
});
