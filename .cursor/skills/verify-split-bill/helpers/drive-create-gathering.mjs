#!/usr/bin/env node
/**
 * Drive: home → fill name → create → assert gathering page → evidence.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const RUN_ID = process.env.RUN_ID || String(Date.now());
const OUT = `/opt/cursor/artifacts/verify-split-bill/${RUN_ID}`;
const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const NAME = process.env.GATHERING_NAME || "验收技能";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
const page = await context.newPage();

await page.goto(`${BASE}/`);
await page.getByLabel("饭局名称").fill(NAME);
await page.getByRole("button", { name: "创建饭局" }).click();
await page.getByRole("heading", { level: 1, name: NAME, exact: true }).waitFor();

const url = page.url();
const shot = path.join(OUT, "create-gathering.png");
await page.screenshot({ path: shot, fullPage: true });

const evidence = {
  feature: "create-gathering",
  runId: RUN_ID,
  gatheringName: NAME,
  url,
  viewport: { width: 375, height: 667 },
  screenshot: shot,
};
writeFileSync(path.join(OUT, "create-gathering.json"), JSON.stringify(evidence, null, 2));

await context.close();
await browser.close();
console.log(JSON.stringify(evidence));
