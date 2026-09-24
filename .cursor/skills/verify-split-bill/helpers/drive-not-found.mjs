#!/usr/bin/env node
/**
 * Drive: invalid gathering URL → not-found page → evidence (AC7 / not-found).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const RUN_ID = process.env.RUN_ID || String(Date.now());
const OUT = `/opt/cursor/artifacts/verify-split-bill/${RUN_ID}`;
const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const INVALID_PATH = process.env.NOT_FOUND_PATH || "/g/not-a-real-gathering";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
const page = await context.newPage();

await page.goto(`${BASE}${INVALID_PATH}`);
await page.getByRole("heading", { name: "找不到这个饭局" }).waitFor();

const ledgerCount = await page.getByText("账目").count();
const shot = path.join(OUT, "not-found.png");
await page.screenshot({ path: shot, fullPage: true });

const evidence = {
  feature: "not-found",
  runId: RUN_ID,
  url: page.url(),
  ledgerMentions: ledgerCount,
  viewport: { width: 375, height: 667 },
  screenshot: shot,
};
writeFileSync(path.join(OUT, "not-found.json"), JSON.stringify(evidence, null, 2));

await context.close();
await browser.close();
console.log(JSON.stringify(evidence));
