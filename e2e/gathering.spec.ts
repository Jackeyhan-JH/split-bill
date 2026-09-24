import { expect, test, type Page } from "@playwright/test";

async function createGathering(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("饭局名称").fill(name);
  await page.getByRole("button", { name: "创建饭局" }).click();
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
  return page.url();
}

test("AC1 empty name does not create a gathering", async ({ page }) => {
  const statuses: number[] = [];
  page.on("response", (response) => {
    if (response.request().method() === "POST" && response.url().includes("/api/gatherings")) {
      statuses.push(response.status());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "聚餐分账" })).toBeVisible();
  await expect(page.getByText("不注册，靠链接分享")).toBeVisible();
  await expect(page.getByLabel("饭局名称")).toBeVisible();
  await expect(page.getByPlaceholder("例如：周五火锅")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建饭局" })).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

  const bodySize = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  const inputSize = await page.getByLabel("饭局名称").evaluate((element) => getComputedStyle(element).fontSize);
  expect(Number.parseFloat(bodySize)).toBeGreaterThanOrEqual(16);
  expect(Number.parseFloat(inputSize)).toBeGreaterThanOrEqual(16);
  const button = await page.getByRole("button", { name: "创建饭局" }).boundingBox();
  expect(button?.height).toBeGreaterThanOrEqual(44);
  expect(button?.width).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "创建饭局" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("请填写饭局名称");
  await expect(page).toHaveURL("/");

  await page.getByLabel("饭局名称").fill("   ");
  await page.getByRole("button", { name: "创建饭局" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("请填写饭局名称");
  await expect(page).toHaveURL("/");
  expect(statuses.every((status) => status >= 400)).toBe(true);
});

test("AC2 named gathering opens on its own URL", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("饭局名称").fill("周五火锅");
  await page.getByRole("button", { name: "创建饭局" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "周五火锅", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/g\/[A-Za-z0-9_-]{22}$/);
  await expect(page).not.toHaveURL("/");
});

test("AC3 a fresh browser context opens the same gathering", async ({ page, browser }) => {
  const url = await createGathering(page, "周五火锅");
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const fresh = await context.newPage();
  await fresh.goto(url);
  await expect(fresh.getByRole("heading", { level: 1, name: "周五火锅", exact: true })).toBeVisible();
  await expect(fresh.getByText("找不到这个饭局")).toHaveCount(0);
  await context.close();
});

test("AC4 a garbage id shows the not-found page", async ({ page }) => {
  const url = await createGathering(page, "周五火锅");
  const id = new URL(url).pathname.split("/").at(-1);
  await page.goto("/g/this-is-not-a-real-gathering");
  await expect(page.getByRole("heading", { name: "找不到这个饭局" })).toBeVisible();
  await expect(page.getByText("链接可能打错了，或饭局不存在")).toBeVisible();
  await expect(page.getByRole("link", { name: "回首页" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "周五火锅", exact: true })).toHaveCount(0);
  await expect(page.getByText(id ?? "周五火锅")).toHaveCount(0);
  const link = await page.getByRole("link", { name: "回首页" }).boundingBox();
  expect(link?.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("link", { name: "回首页" }).click();
  await expect(page.getByRole("heading", { name: "聚餐分账" })).toBeVisible();
});

test("AC5 two gatherings keep separate links", async ({ page }) => {
  const urlA = await createGathering(page, "A");
  const urlB = await createGathering(page, "B");
  expect(urlA).not.toBe(urlB);

  await page.goto(urlA);
  await expect(page.getByRole("heading", { level: 1, name: "A", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "B", exact: true })).toHaveCount(0);

  await page.goto(urlB);
  await expect(page.getByRole("heading", { level: 1, name: "B", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "A", exact: true })).toHaveCount(0);
});

test("AC6 creating a gathering asks for no account", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("input")).toHaveCount(1);
  await expect(page.locator('input[type="email"], input[type="password"], input[type="tel"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /登录|注册/ })).toHaveCount(0);

  await createGathering(page, "周五火锅");
  await expect(page.locator("input")).toHaveCount(0);
  await expect(page.locator('input[type="email"], input[type="password"], input[type="tel"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /登录|注册/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "周五火锅", exact: true })).toBeVisible();
});
