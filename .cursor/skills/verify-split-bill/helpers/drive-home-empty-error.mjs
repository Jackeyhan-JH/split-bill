#!/usr/bin/env node
/**
 * Drive: home → empty submit → alert → evidence (AC6 / home-validation).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const RUN_ID = process.env.RUN_ID || String(Date.now());
const OUT = `/opt/cursor/artifacts/verify-split-bill/${RUN_ID}`;
const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
const page = await context.newPage();

await page.goto(`${BASE}/`);
await page.getByRole("button", { name: "创建饭局" }).click();
await page.locator("main").getByRole("alert").waitFor({ state: "visible" });

const alertText = await page.locator("main").getByRole("alert").innerText();
const url = page.url();
const shot = path.join(OUT, "home-empty-error.png");
await page.screenshot({ path: shot, fullPage: true });

const evidence = {
  feature: "home-empty-error",
  runId: RUN_ID,
  url,
  alertText,
  viewport: { width: 375, height: 667 },
  screenshot: shot,
};
writeFileSync(path.join(OUT, "home-empty-error.json"), JSON.stringify(evidence, null, 2));

await context.close();
await browser.close();
console.log(JSON.stringify(evidence));
