import { expect, test } from "@playwright/test";
import { hydrated, prisma, resetRateLimits, signInAs } from "./helpers";
import { startWebhookSink } from "./webhook-sink";

test.beforeEach(resetRateLimits);

test("Module 4: create snapshot with a new realtor → PDF → investor page scan → listing lead tagged with realtor → realtor stats email", async ({ page, browser }, info) => {
  const sink = await startWebhookSink(info.project.name === "mobile" ? 4594 : 4595);
  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: sink.url } });
  const tag = `${info.project.name}${Date.now()}`;
  const realtorEmail = `agent.${tag}@example.test`;

  await signInAs(page, "maya@harborline.example");
  await page.goto("/dashboard/snapshots/new");
  await hydrated(page);
  await page.getByLabel("Property address").fill(`${String(Date.now()).slice(-4)} Test Harbor Dr, Tampa, FL 33611`);
  await expect(page.getByLabel("State")).toHaveValue("FL");
  await page.getByLabel("List price").fill("400,000");
  await page.getByLabel("Monthly rent").fill("2,950");
  await page.getByLabel("Realtor").selectOption({ label: "+ Add a new realtor" });
  await page.getByLabel("Agent name").fill("Tess Agent");
  await page.getByLabel("Brokerage").fill("Example Realty");
  await page.getByLabel("Email").fill(realtorEmail);
  await page.getByRole("radio", { name: /Modern/ }).click();
  await page.getByRole("button", { name: "Create snapshot" }).click();
  await page.waitForURL(/\/dashboard\/snapshots\/[^/]+\?created=1/);
  await expect(page.getByText("Snapshot ready")).toBeVisible();

  const snap = await prisma.snapshot.findFirstOrThrow({ where: { realtor: { email: realtorEmail } }, include: { realtor: true } });
  expect(snap).toMatchObject({ listPriceCents: 40_000_000, rentCents: 295_000, rentSource: "MANUAL", template: "MODERN", state: "FL" });
  expect(snap.taxesAnnualCents).toBeGreaterThan(0); // public record or state table
  expect(snap.insuranceAnnualCents).toBeGreaterThan(0);

  const pdf = await page.request.get(`/api/snapshots/${snap.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const classic = await page.request.get(`/api/snapshots/${snap.id}/pdf?template=CLASSIC`);
  expect(classic.status()).toBe(200);

  // Anonymous investor scans the QR.
  const url = (await page.getByTestId("snapshot-url").textContent())!;
  const investor = await browser.newContext({ ...(info.project.use as object) });
  const ip = await investor.newPage();
  await ip.goto(url.replace(/^https?:\/\/[^/]+/, ""));
  await hydrated(ip);
  await expect(ip.getByTestId("listing-address")).toContainText("Test Harbor Dr");
  await expect(ip.getByTestId("listing-columns")).toContainText("20% down");
  await expect(ip.getByTestId("listing-columns")).toContainText("25% down");
  await expect(ip.getByTestId("listing-realtor")).toContainText("Tess Agent, Example Realty");
  await expect(ip.getByTestId("respa-note")).toContainText("no fee or thing of value is paid for referrals");
  await expect(ip.getByTestId("broker-footer")).toContainText("Company NMLS #2203117");
  await expect.poll(() => prisma.event.count({ where: { type: "snapshot.scanned", entityId: snap.id } }), { timeout: 10_000 }).toBe(1);
  await ip.reload(); // same visitor within 6 hours is not double-counted
  await hydrated(ip);
  await ip.waitForTimeout(800);
  expect(await prisma.event.count({ where: { type: "snapshot.scanned", entityId: snap.id } })).toBe(1);

  // Calculator works on the listing; financing request becomes a SNAPSHOT lead tagged with the realtor.
  await expect(ip.getByTestId("dscr-value")).toBeVisible();
  const email = `listing.${tag}@example.test`;
  await ip.getByLabel("Full name").fill("List Investor");
  await ip.getByLabel("Email", { exact: true }).fill(email);
  await ip.locator('input[name="investmentProperty"]').check();
  await ip.locator('input[name="consentContact"]').check();
  await ip.waitForTimeout(1600);
  await ip.getByRole("button", { name: "Get my financing estimate" }).click();
  await expect(ip.getByText("Check your inbox")).toBeVisible({ timeout: 20_000 });
  const lead = await prisma.lead.findFirstOrThrow({ where: { email } });
  expect(lead).toMatchObject({ source: "SNAPSHOT", snapshotId: snap.id, realtorId: snap.realtorId });
  await expect.poll(() => sink.received.find((r) => r.body?.data?.lead?.email === email)?.headers["x-dscr-event"], { timeout: 20_000 }).toBe("snapshot.lead");
  await investor.close();

  // Realtor stats + email to the realtor.
  await page.goto(`/dashboard/snapshots/${snap.id}`);
  await expect(page.getByTestId("scan-count")).toHaveText("1");
  await page.goto("/dashboard/snapshots");
  await hydrated(page);
  const card = page.getByTestId("realtor-stats").locator("div.rounded-2xl", { hasText: realtorEmail }).first();
  await card.getByRole("button", { name: "Email stats" }).click();
  await expect(card.getByText("Sent")).toBeVisible({ timeout: 15_000 });
  const mail = await prisma.devEmail.findFirstOrThrow({ where: { to: realtorEmail } });
  expect(mail.subject).toContain("1 scan in the last 30 days");
  expect(mail.html).toContain("Equal Housing Opportunity");

  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: null } });
  await sink.close();
});
