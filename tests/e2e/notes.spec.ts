import { expect, test } from "@playwright/test";
import { hydrated, prisma, resetRateLimits, signInAs } from "./helpers";

test.beforeEach(resetRateLimits);

test("Module 5: paste notes → review (nothing saved) → confirm → draft scenario + checklist + follow-up; text not retained", async ({ page }) => {
  await signInAs(page, "maya@harborline.example");
  const broker = await prisma.broker.findUniqueOrThrow({ where: { slug: "harborline" } });
  const before = { scenarios: await prisma.scenario.count({ where: { brokerId: broker.id } }), notes: await prisma.savedNote.count({ where: { brokerId: broker.id } }) };

  await page.goto("/dashboard/notes");
  await hydrated(page);
  await page.getByRole("button", { name: /Try: duplex purchase/ }).click();
  await page.getByRole("button", { name: "Extract the deal" }).click();
  await expect(page.getByTestId("notes-review")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Name")).toHaveValue("Marcus Bellweather");
  await expect(page.getByLabel("Property address")).toHaveValue(/2714 Palmetto Grove Way/);
  await expect(page.getByLabel("State")).toHaveValue("FL");
  await expect(page.getByLabel("Purchase price")).toHaveValue("468,000");
  await expect(page.getByLabel("Monthly rent")).toHaveValue("3,850");

  // Nothing is saved at the review step.
  expect(await prisma.scenario.count({ where: { brokerId: broker.id } })).toBe(before.scenarios);
  expect(await prisma.savedNote.count({ where: { brokerId: broker.id } })).toBe(before.notes);

  const email = `notes.${Date.now()}@example.test`;
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create scenario, checklist and follow-up" }).click();
  await page.waitForURL(/\/dashboard\/notes\/[^/]+$/, { timeout: 30_000 });

  await expect(page.getByTestId("checklist")).toContainText("rent roll");
  await expect(page.getByTestId("checklist")).toContainText("purchase contract");
  await expect(page.getByTestId("followup-body")).toContainText("Hi Marcus");
  await expect(page.getByTestId("followup-body")).toContainText("/b/harborline/s/");
  await expect(page.getByTestId("followup-body")).toContainText("NMLS #2203117");
  await expect(page.getByTestId("followup-body")).not.toContainText(/approved|guaranteed|qualif/i);
  await expect(page.getByTestId("text-not-saved")).toBeVisible();

  const note = await prisma.savedNote.findFirstOrThrow({ where: { brokerId: broker.id }, orderBy: { createdAt: "desc" } });
  expect(note.sourceText).toBeNull();
  const s = await prisma.scenario.findUniqueOrThrow({ where: { id: note.scenarioId! }, include: { options: true } });
  expect(s).toMatchObject({ origin: "NOTES", status: "DRAFT", investorEmail: email, valueCents: 46_800_000, rentCents: 385_000, state: "FL" });
  expect(s.taxesAnnualCents).toBe(640 * 12 * 100); // stated monthly taxes, annualized by the engine
  expect(s.options).toHaveLength(3);
  expect(s.options.every((o) => o.loanAmountCents === 35_100_000)).toBe(true); // 25% down
  const lead = await prisma.lead.findFirstOrThrow({ where: { email } });
  expect(lead.source).toBe("NOTES");
  expect(s.leadId).toBe(lead.id);

  await page.getByTestId("open-scenario").click();
  await page.waitForURL(/\/dashboard\/scenarios\//);
  await expect(page.getByText("Marcus Bellweather")).toBeVisible();
});
