import { expect, test } from "@playwright/test";

test("AC1 home creates list with private link URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "书单" })).toBeVisible();
  await page.getByLabel("书单名称").fill("周末读书会");
  await page.getByRole("button", { name: "创建书单" }).click();
  await expect(page).toHaveURL(/\/l\/[A-Za-z0-9_-]{22}$/);
  await expect(page.getByRole("dialog", { name: "选择「我是谁」" })).toBeVisible();
});

test("empty name shows validation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "创建书单" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("请填写书单名称");
  await expect(page).toHaveURL("/");
});

test("AC6 mobile layout basics on home", async ({ page }) => {
  await page.goto("/");
  const bodySize = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(Number.parseFloat(bodySize)).toBeGreaterThanOrEqual(16);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
