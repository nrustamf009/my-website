import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAs } from "./helpers";

const prisma = new PrismaClient();

test("Module 4: create snapshot, download PDF, scan QR, capture tagged lead", async ({ page, browser }) => {
  await signInAs(page, "priya@evergreenkey.example");
  await page.goto("/dashboard/snapshots/new");
  const address = `${Math.floor(Math.random() * 9000) + 1000} Cedar Hollow Rd, Boise, ID 83706`;
  await page.getByLabel("Address").fill(address);
  await page.locator("input[placeholder='425,000']").fill("410000");
  await page.getByRole("button", { name: "Estimate" }).click();
  await expect(page.getByText(/Mock estimate/)).toBeVisible();
  await page.locator("select[name=realtorId]").selectOption("new");
  await page.getByLabel("Realtor name").fill("Jamie Test-Realtor");
  await page.getByLabel("Brokerage", { exact: true }).fill("Summit Test Realty");
  await page.getByRole("button", { name: "Create snapshot" }).click();
  await expect(page).toHaveURL(/\/dashboard\/snapshots\/.+\?created=1/);
  await expect(page.getByText("Snapshot created")).toBeVisible();

  const snap = await prisma.snapshot.findFirstOrThrow({ where: { address }, include: { broker: true } });

  const pdf = await page.request.get(`/dashboard/snapshots/${snap.id}/pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const body = await pdf.body();
  expect(body.subarray(0, 4).toString()).toBe("%PDF");

  // Investor scans the QR on their phone (no session).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile" });
  const phone = await ctx.newPage();
  await phone.goto(`/b/${snap.broker.slug}/l/${snap.token}?src=qr`);
  await expect(phone.getByRole("heading", { name: address })).toBeVisible();
  await expect(phone.getByText("Jamie Test-Realtor").first()).toBeVisible();
  await expect(phone.getByText("NMLS #2051876").first()).toBeVisible();
  expect(await prisma.snapshotScan.count({ where: { snapshotId: snap.id } })).toBe(1);

  await phone.getByLabel("Full name").fill("Qr Investor");
  await phone.getByLabel("Email", { exact: true }).fill(`qr.${Date.now()}@example.test`);
  await phone.locator('input[name="consent"]').check();
  await phone.waitForTimeout(1600);
  await phone.getByRole("button", { name: "Get pre-qualified for this property" }).click();
  await expect(phone.getByText("Check your inbox")).toBeVisible();

  const lead = await prisma.lead.findFirstOrThrow({ where: { snapshotId: snap.id } });
  expect(lead.source).toBe("LISTING");
  expect(lead.realtorId).toBe(snap.realtorId);

  await page.goto("/dashboard/snapshots/realtors");
  const row = page.locator("tr", { hasText: "Jamie Test-Realtor" });
  await expect(row).toContainText("1");
  await ctx.close();
});
