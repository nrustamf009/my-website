import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAs } from "./helpers";

const prisma = new PrismaClient();

test("Agency onboards a new broker: invite email, magic-link sign-in, branded public page", async ({ page, browser }) => {
  const n = Date.now() % 100000;
  const login = `newbroker${n}@example.test`;
  const slug = `summit-${n}`;
  await signInAs(page, "admin@northbeam.example");
  await page.goto("/admin/brokers/new");
  await page.getByLabel("Loan officer name").fill("Jordan Testbroker");
  await page.getByLabel("Company name").fill(`Summit Test Lending ${n}`);
  await page.getByLabel("Individual NMLS ID").fill("555123");
  await page.getByLabel("Public contact email").fill(`hello${n}@example.test`);
  await page.getByLabel("Phone").fill("(555) 010-3333");
  await page.locator('input[name="accentColor"]').fill("#6B2D5C");
  await page.getByLabel("Public URL slug").fill(slug);
  await page.getByLabel("Broker login email").fill(login);
  await page.getByRole("button", { name: "Create broker" }).click();
  await expect(page.getByText("We emailed a welcome invite")).toBeVisible();

  const invite = await prisma.devEmail.findFirstOrThrow({ where: { to: login } });
  expect(invite.subject).toContain("set up your DSCR Investor Toolkit");

  // The new broker signs in with a magic link.
  const ctx = await browser.newContext();
  const b = await ctx.newPage();
  await b.goto("/login");
  await b.getByLabel("Work email").fill(login);
  await b.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(b).toHaveURL(/check-email/);
  const link = await prisma.devEmail.findFirstOrThrow({ where: { to: login, subject: { contains: "sign-in link" } } });
  const href = link.html.match(/href="([^"]+callback[^"]+)"/)![1]!.replace(/&amp;/g, "&");
  await b.goto(href);
  await expect(b).toHaveURL(/\/dashboard/);
  await expect(b.getByText(`Summit Test Lending ${n}`).filter({ visible: true }).first()).toBeVisible();

  await b.goto(`/b/${slug}/check`);
  await expect(b.getByText("NMLS #555123").first()).toBeVisible();
  await ctx.close();
});
