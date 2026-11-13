import { expect, test } from "@playwright/test";
import { cronHeaders, hydrated, prisma, signInAs } from "./helpers";
import { startWebhookSink } from "./webhook-sink";

test("Leads CRM-lite: filter, status → webhook + timeline, owner, notes, CSV export, CCPA delete; ROI crons", async ({ page, request }, info) => {
  const sink = await startWebhookSink(info.project.name === "mobile" ? 4590 : 4591);
  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: sink.url } });
  const broker = await prisma.broker.findUniqueOrThrow({ where: { slug: "harborline" } });
  const email = `crm.${info.project.name}.${Date.now()}@example.test`;

  await signInAs(page, "maya@harborline.example");
  await page.goto("/dashboard/leads/new");
  await hydrated(page);
  await page.getByLabel("Name").fill("Crm Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill("(555) 010-7777");
  await page.getByRole("button", { name: "Add lead" }).click();
  await page.waitForURL(/\/dashboard\/leads\/(?!new)[^/]+$/);
  const lead = await prisma.lead.findFirstOrThrow({ where: { email } });
  expect(lead.source).toBe("MANUAL");

  await page.goto(`/dashboard/leads?q=${encodeURIComponent("Crm Tester")}`);
  await expect(page.getByTestId("lead-table").locator("tbody tr")).toHaveCount(1);
  await page.goto("/dashboard/leads?status=CLOSED");
  await expect(page.getByTestId("lead-table")).toContainText("Casey Lindqvist");
  await expect(page.getByTestId("lead-table")).not.toContainText("Jordan Whitaker");

  await page.goto(`/dashboard/leads/${lead.id}`);
  await hydrated(page);
  await page.getByTestId("status-picker").getByRole("radio", { name: "In progress" }).click();
  await expect.poll(async () => (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("IN_PROGRESS");
  await expect.poll(() => sink.received.find((r) => r.headers["x-dscr-event"] === "lead.updated" && r.body.data.lead.id === lead.id)?.body.data.lead.previousStatus, { timeout: 15_000 }).toBe("NEW");
  await page.reload();
  await expect(page.getByTestId("lead-timeline")).toContainText("Updated: in progress");
  const theo = await prisma.user.findUniqueOrThrow({ where: { email: "theo@harborline.example" } });
  await page.getByLabel("Owner").selectOption(theo.id);
  await expect.poll(async () => (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).ownerUserId).toBe(theo.id);
  await page.getByLabel("Notes").fill("Prefers texts after 5pm.");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  // CSV export (tenant-scoped, formula-safe).
  const csv = await page.request.get("/api/leads/export?status=IN_PROGRESS");
  expect(csv.status()).toBe(200);
  const body = await csv.text();
  expect(body).toContain("Crm Tester");
  expect(body).toContain("Prefers texts after 5pm.");
  expect(body).not.toContain("Lena Vasquez"); // other broker

  // CCPA delete: lead and consents gone, scenarios anonymized, event kept without PII.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete personal data (CCPA)" }).click();
  await page.waitForURL(/\/dashboard\/leads\?deleted=1/);
  expect(await prisma.lead.count({ where: { email } })).toBe(0);
  const del = await prisma.event.findFirstOrThrow({ where: { brokerId: broker.id, type: "lead.deleted", entityId: lead.id } });
  expect(del.meta).not.toContain(email);

  // Crons require the CRON_SECRET bearer token when one is configured.
  if (Object.keys(cronHeaders()).length) expect((await request.get("/api/cron/weekly-roi")).status()).toBe(401);
  await prisma.broker.updateMany({ data: { lastRoiEmailAt: null } });
  await prisma.agency.updateMany({ data: { lastRollupAt: null } });
  const roi = await request.get("/api/cron/weekly-roi", { headers: cronHeaders() });
  expect(roi.status()).toBe(200);
  await expect.poll(() => prisma.devEmail.count({ where: { subject: { startsWith: "Your week:" } } }), { timeout: 20_000 }).toBeGreaterThan(0);
  const rollup = await request.get("/api/cron/agency-rollup", { headers: cronHeaders() });
  expect(rollup.status()).toBe(200);
  await expect.poll(() => prisma.devEmail.count({ where: { to: { contains: "admin@northbeam.example" }, subject: { contains: "leads across" } } }), { timeout: 20_000 }).toBeGreaterThan(0);
  expect((await request.get("/api/cron/webhooks", { headers: cronHeaders() })).status()).toBe(200);

  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: null } });
  await sink.close();
});
