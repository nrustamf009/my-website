import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAs } from "./helpers";

const prisma = new PrismaClient();

test("Module 3: Money List shows ranked opportunities, drafts, contacted, digest", async ({ page }) => {
  await signInAs(page, "maya@harborline.example");
  await page.goto("/dashboard/money-list");
  const cards = page.getByTestId("opportunity");
  const n = await cards.count();
  expect(n).toBeGreaterThanOrEqual(8);
  expect(n).toBeLessThanOrEqual(12);
  await expect(page.getByText("Rate drop").first()).toBeVisible();
  await expect(page.getByText("Prepay ends soon").first()).toBeVisible();
  await expect(page.getByText(/month seasoning/).first()).toBeVisible();

  const first = cards.first();
  await first.getByRole("button", { name: "Draft message" }).click();
  await expect(first.getByTestId("draft")).toBeVisible({ timeout: 30_000 });
  expect((await first.getByTestId("draft").inputValue()).length).toBeGreaterThan(80);
  await first.getByRole("button", { name: "Copy" }).click();
  await expect(first.getByRole("button", { name: "Copied ✓" })).toBeVisible();
  const borrower = await first.locator("h3").innerText();
  await first.getByRole("button", { name: "Mark contacted" }).click();
  // The card moves into the "Contacted" section.
  await expect(page.getByRole("heading", { name: "Contacted" })).toBeVisible();
  const moved = page.getByTestId("opportunity").filter({ hasText: borrower }).filter({ has: page.getByRole("button", { name: "Undo contacted" }) });
  await expect(moved).toHaveCount(1);
  await expect(cards.filter({ has: page.getByRole("button", { name: "Undo contacted" }) })).toHaveCount(1);
  await moved.getByRole("button", { name: "Undo contacted" }).click();
  await expect(page.getByRole("heading", { name: "Contacted" })).toBeHidden();

  const before = await prisma.devEmail.count({ where: { subject: { startsWith: "Your Money List" } } });
  await page.getByRole("button", { name: "Email me the digest" }).click();
  await expect(page.getByText(/Digest sent/)).toBeVisible();
  expect(await prisma.devEmail.count({ where: { subject: { startsWith: "Your Money List" } } })).toBe(before + 1);
});

test("Module 3: CSV import validates with clear errors, then imports", async ({ page }) => {
  await signInAs(page, "daniel@cactusridge.example");
  await page.goto("/dashboard/money-list/import");
  const bad = "borrower,property_address,loan_amount,rate,closing_date,prepay_type,interest_only\nPat Doe,\"5 Elm St, Mesa, AZ 85212\",lots,7.5,2024-02-30,4-3-2-1,yes\n";
  await page.getByTestId("csv-input").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(bad) });
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("3 problems to fix")).toBeVisible();
  await expect(page.getByText("Use a number like 325000")).toBeVisible();
  await expect(page.getByText("Use YYYY-MM-DD or MM/DD/YYYY")).toBeVisible();

  const res = await page.request.get("/api/money-list/template");
  const template = await res.text();
  await page.getByTestId("csv-input").setInputFiles({ name: "template.csv", mimeType: "text/csv", buffer: Buffer.from(template) });
  await page.getByRole("button", { name: "Import loans" }).click();
  await expect(page.getByText("Import complete")).toBeVisible();
  await expect(page.getByText(/Imported 2 new loans|updated 2/)).toBeVisible();
});
