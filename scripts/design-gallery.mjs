#!/usr/bin/env node
/**
 * Screenshots /dev/design for every theme at 390 and 1440 px (`npm run design:gallery`).
 * Needs a running app (dev, or `next start` with DEMO_LOGIN=true). Base URL: GALLERY_URL (default http://localhost:3000).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.GALLERY_URL ?? "http://localhost:3000";
const out = "node_modules/.cache/design-gallery";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const theme of ["maison", "terminal", "atelier"]) {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/dev/design?theme=${theme}`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const path = `${out}/${theme}-${width}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log("saved", path);
    await page.close();
  }
}
await browser.close();
