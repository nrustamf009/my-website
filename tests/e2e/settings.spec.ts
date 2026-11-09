import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAs } from "./helpers";
import { startWebhookSink } from "./webhook-sink";

const prisma = new PrismaClient();

test("Settings: branding saves, validation errors show, webhook test delivers", async ({ page }) => {
  const sink = await startWebhookSink(4597);
  const original = await prisma.broker.findUniqueOrThrow({ where: { slug: "evergreen-key" } });
  await signInAs(page, "priya@evergreenkey.example");
  await page.goto("/dashboard/settings");

  await page.getByLabel("Individual NMLS ID").fill("12");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("NMLS ID should be 3–10 digits").first()).toBeVisible();

  await page.getByLabel("Individual NMLS ID").fill(original.nmlsId);
  await page.locator('input[name="accentColor"]').fill("#7A3E9D");
  await page.getByLabel("Webhook URL (your CRM, Zapier, Make…)").fill(sink.url);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved ✓")).toBeVisible();

  await page.getByRole("button", { name: "Send test event" }).click();
  await expect(page.getByText("Delivered (HTTP 200)")).toBeVisible();
  expect(sink.received.at(-1)?.body.event).toBe("test");

  await page.goto("/b/evergreen-key/check");
  const accent = await page.locator("header a[href^='tel:']").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(accent).toBe("rgb(122, 62, 157)");

  await prisma.broker.update({ where: { id: original.id }, data: { accentColor: original.accentColor, webhookUrl: null } });
  await sink.close();
});
