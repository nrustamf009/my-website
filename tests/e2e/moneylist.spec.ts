import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { hydrated, prisma, signInAs } from "./helpers";
import { startWebhookSink } from "./webhook-sink";

test("Module 3: import CSV (create, then update), ranked list, filters, what-if, draft, contacted + webhook, snooze, history", async ({ page }, info) => {
  const sink = await startWebhookSink(info.project.name === "mobile" ? 4596 : 4597);
  await prisma.broker.update({ where: { slug: "harborline" }, data: { webhookUrl: sink.url, marketRateMilli: 6_625 } });
  const tag = `${info.project.name}${Date.now()}`;
  const pat = info.project.name === "mobile" ? "Pat Mobilecase" : "Pat Desktopcase";
  const lee = info.project.name === "mobile" ? "Lee Mobilecase" : "Lee Desktopcase";
  const csv = [
    "Client Name,E-mail,Phone,Subject Property,Loan Amt,Note Rate,Funding Date,Amortization,PPP,Prepay Term (years),Appraised Value",
    `${pat},pat.${tag}@example.test,(555) 010-1111,"77 Test Ave, Austin, TX 78701","$410,000",8.25%,${iso(-21)},Fixed,1,1,560000`,
    `${lee},lee.${tag}@example.test,,"9 Sample Ct, Tampa, FL 33611",250000,6.5,${iso(-30)},Interest Only,none,,`,
    `Bad Row,,,"1 Nowhere",abc,7,2099-01-01,fixed,4-3-2-1,,`,
  ].join("\n");

  await signInAs(page, "maya@harborline.example");
  await page.goto("/dashboard/money-list/import");
  await hydrated(page);
  await page.getByTestId("csv-input").setInputFiles({ name: "los-export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByTestId("import-summary")).toContainText("2 ready");
  await expect(page.getByTestId("import-summary")).toContainText("2 new · 0 will update");
  await expect(page.getByText("Use a number like 325000")).toBeVisible();
  await expect(page.getByText("Closing date is in the future")).toBeVisible();
  await page.getByTestId("import-confirm").click();
  await expect(page.getByTestId("import-result")).toContainText("2 new, 0 updated, 3 rows skipped");

  // Re-import the same file: rows update in place (dedupe by email + address).
  await page.goto("/dashboard/money-list/import");
  await hydrated(page);
  await page.getByTestId("csv-input").setInputFiles({ name: "los-export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByTestId("import-summary")).toContainText("0 new · 2 will update");
  await page.getByTestId("import-confirm").click();
  await expect(page.getByTestId("import-result")).toContainText("0 new, 2 updated");
  const broker = await prisma.broker.findUniqueOrThrow({ where: { slug: "harborline" } });
  expect(await prisma.closedLoan.count({ where: { brokerId: broker.id, email: { contains: tag } } })).toBe(2);

  // Ranked list: the 8.25% loan (rate drop) is on it with a dollar estimate.
  await page.goto("/dashboard/money-list");
  const row = page.getByTestId("ml-row").filter({ hasText: pat });
  await expect(row).toContainText("Rate −1.625%");
  await expect(row.getByTestId("ml-benefit")).toHaveText(/^\$[\d,]+$/);
  expect(await page.getByTestId("ml-row").count()).toBeGreaterThanOrEqual(8);

  // Filter chips and what-if.
  await page.getByRole("link", { name: /^ARM reset/ }).click();
  await expect(page.getByTestId("ml-row").first()).toContainText("ARM resets in");
  await page.goto("/dashboard/money-list?rate=5.5");
  await expect(page.getByTestId("whatif-banner")).toContainText("5.5%");
  await expect(page.getByTestId("ml-row").filter({ hasText: lee })).toBeVisible(); // 6.5% IO only shows up at 5.5%

  // Detail: draft, copy-ready email with the code-appended footer, mark contacted → webhook.
  await page.goto("/dashboard/money-list");
  await page.getByTestId("ml-row").filter({ hasText: pat }).getByRole("link", { name: pat, exact: true }).click();
  await hydrated(page);
  await page.getByRole("button", { name: "Draft message" }).click();
  await expect(page.getByTestId("draft-email")).toContainText("Hi Pat", { timeout: 20_000 });
  await expect(page.getByTestId("draft-email")).toContainText("NMLS #2203117");
  await expect(page.getByTestId("draft-email")).toContainText("Equal Housing Opportunity");
  await expect(page.getByTestId("draft-email")).not.toContainText(/approved|guaranteed|qualif/i);
  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.getByTestId("draft-sms")).toContainText("Reply STOP to opt out.");
  await page.getByRole("button", { name: "Mark contacted (email)" }).click();
  await expect(page.getByTestId("loan-history")).toContainText("Contacted by email");
  await expect.poll(() => sink.received.find((r) => r.headers["x-dscr-event"] === "money_list.contacted")?.body.data.borrowerName, { timeout: 15_000 }).toBe(pat);
  const hit = sink.received.find((r) => r.headers["x-dscr-event"] === "money_list.contacted")!;
  expect(hit.headers["x-dscr-signature"]).toBe(`sha256=${createHmac("sha256", broker.webhookSecret!).update(hit.raw).digest("hex")}`);
  expect(await prisma.event.count({ where: { brokerId: broker.id, type: "moneylist.contacted" } })).toBeGreaterThan(0);

  // Worked loans stay on the board with their status.
  await page.goto("/dashboard/money-list");
  await expect(page.getByTestId("ml-row").filter({ hasText: pat })).toContainText("Contacted");
  const leeLoan = await prisma.closedLoan.findFirstOrThrow({ where: { brokerId: broker.id, email: `lee.${tag}@example.test` } });
  await page.goto(`/dashboard/money-list/${leeLoan.id}`);
  await hydrated(page);
  await page.getByRole("button", { name: "60d" }).click();
  await expect(page.getByTestId("loan-history")).toContainText("Snoozed 60 days");
  expect((await prisma.closedLoan.findUniqueOrThrow({ where: { id: leeLoan.id } })).status).toBe("SNOOZED");
  await sink.close();
});

test("Money List is tenant-scoped: another broker's loan is a 404", async ({ page }) => {
  const other = await prisma.closedLoan.findFirstOrThrow({ where: { broker: { slug: "cactus-ridge" } } });
  await signInAs(page, "maya@harborline.example");
  const res = await page.goto(`/dashboard/money-list/${other.id}`);
  expect(res?.status()).toBe(404);
});

function iso(monthsAgo: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + monthsAgo);
  return d.toISOString().slice(0, 10);
}
