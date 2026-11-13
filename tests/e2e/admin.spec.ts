import { expect, test } from "@playwright/test";
import { hydrated, prisma, signInAs } from "./helpers";

test("Agency admin: impersonate (audited) → suspend → public page unavailable → module off hides it → restore", async ({ page }) => {
  const broker = await prisma.broker.findUniqueOrThrow({ where: { slug: "evergreen-key" } });
  await signInAs(page, "admin@northbeam.example");
  await page.goto(`/admin/brokers/${broker.id}`);
  await hydrated(page);

  await page.getByRole("button", { name: "Impersonate →" }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(/Viewing as/)).toContainText(broker.companyName);
  expect(await prisma.auditLog.count({ where: { targetBrokerId: broker.id, action: { contains: "IMPERSONATE" } } })).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stop impersonating" }).click();
  await page.waitForURL(/\/admin/);

  await page.goto(`/admin/brokers/${broker.id}`);
  await page.getByRole("button", { name: "suspended" }).click();
  await expect.poll(async () => (await prisma.broker.findUniqueOrThrow({ where: { id: broker.id } })).status).toBe("SUSPENDED");
  const pub = await page.request.get(`/b/${broker.slug}/check`);
  expect(await pub.text()).toMatch(/unavailable/i);
  await page.getByRole("button", { name: "active" }).click();
  await expect.poll(async () => (await prisma.broker.findUniqueOrThrow({ where: { id: broker.id } })).status).toBe("ACTIVE");

  // Turn Listing Snapshot off for this broker: the public listing page and dashboard nav hide it.
  await page.locator("label", { hasText: "Listing Snapshot" }).locator("input").uncheck();
  await page.getByRole("button", { name: "Save modules" }).click();
  await expect.poll(async () => JSON.parse((await prisma.broker.findUniqueOrThrow({ where: { id: broker.id } })).features ?? "{}").snapshot).toBe(false);
  const snap = await prisma.snapshot.findFirstOrThrow({ where: { brokerId: broker.id } });
  expect(await (await page.request.get(`/b/${broker.slug}/l/${snap.token}`)).text()).toMatch(/unavailable/i);
  await page.locator("label", { hasText: "Listing Snapshot" }).locator("input").check();
  await page.getByRole("button", { name: "Save modules" }).click();
  await expect.poll(async () => JSON.parse((await prisma.broker.findUniqueOrThrow({ where: { id: broker.id } })).features ?? "{}").snapshot).toBe(true);
  expect(await prisma.auditLog.count({ where: { targetBrokerId: broker.id, action: { contains: "STATUS" } } })).toBeGreaterThan(0);
});

test("Roles: a loan officer can't open broker settings or the agency admin", async ({ page }) => {
  await signInAs(page, "theo@harborline.example");
  await page.goto("/dashboard/settings/program");
  await expect(page).toHaveURL(/\/dashboard(\?|$)/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
});
