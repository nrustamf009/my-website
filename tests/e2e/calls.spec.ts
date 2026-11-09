import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAs } from "./helpers";

const prisma = new PrismaClient();

test("Module 5: notes → extraction → review → draft scenario, checklist and email", async ({ page }) => {
  await signInAs(page, "priya@evergreenkey.example");
  await page.goto("/dashboard/calls/new");
  await page.getByRole("button", { name: "Sample: cash-out refi (LO notes)" }).click();
  await page.getByRole("button", { name: "Extract deal details" }).click();
  await expect(page).toHaveURL(/\/dashboard\/calls\/(?!new)[a-z0-9]+$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Renata Szabo");
  await expect(page.getByLabel("Loan purpose")).toHaveValue("CASH_OUT");

  // Broker corrects a field during review.
  await page.getByLabel("Monthly rent").fill("2400");
  await page.getByRole("button", { name: "Create draft scenario + checklist + email" }).click();
  await expect(page).toHaveURL(/converted=1/);
  await expect(page.getByTestId("checklist")).toContainText("seasoning");
  await expect(page.getByTestId("followup-body")).toContainText("Renata");

  const callId = new URL(page.url()).pathname.split("/").pop()!;
  const call = await prisma.callSession.findUniqueOrThrow({ where: { id: callId } });
  const sc = await prisma.scenario.findUniqueOrThrow({ where: { id: call.scenarioId! }, include: { options: true } });
  expect(sc.status).toBe("DRAFT");
  expect(sc.origin).toBe("CALL");
  expect(sc.loanPurpose).toBe("CASH_OUT");
  expect(sc.monthlyRent).toBe(2400);
  expect(sc.options.length).toBe(3);
  await page.getByRole("link", { name: "Open draft scenario" }).click();
  await expect(page.getByRole("heading", { name: /Edit scenario · Renata Szabo/ })).toBeVisible();
});

test("Module 5: audio upload is transcribed (mock) and deleted", async ({ page }) => {
  await signInAs(page, "priya@evergreenkey.example");
  await page.goto("/dashboard/calls/new");
  await page.getByRole("button", { name: "Upload recording (MP3 / M4A)" }).click();
  await page.getByTestId("audio-input").setInputFiles({ name: "call.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(2048, 1) });
  await expect(page).toHaveURL(/\/dashboard\/calls\/(?!new)[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Jordan Ellison");
  await expect(page.getByText("audio deleted after transcription")).toBeVisible();
});

test("Module 5: rejects non-audio uploads", async ({ page }) => {
  await signInAs(page, "priya@evergreenkey.example");
  const res = await page.request.post("/api/calls/upload", { multipart: { file: { name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") } } });
  expect(res.status()).toBe(400);
});
