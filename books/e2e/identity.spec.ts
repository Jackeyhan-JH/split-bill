import { expect, test, type Page } from "@playwright/test";

async function createList(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("书单名称").fill(name);
  await page.getByRole("button", { name: "创建书单" }).click();
  await expect(page).toHaveURL(/\/l\/[A-Za-z0-9_-]{22}$/);
  return page.url();
}

async function setupThreeMembers(page: Page) {
  await page.getByLabel("成员名").fill("阿明");
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("小红");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
}

test("AC3 identity gate blocks actions until chosen", async ({ page }) => {
  await createList(page, "周末读书会");
  await setupThreeMembers(page);
  await expect(page.getByRole("dialog", { name: "选择「我是谁」" })).toBeVisible();
  await expect(page.getByText(/^当前：/)).toHaveCount(0);

  await page.getByRole("dialog", { name: "选择「我是谁」" }).getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await expect(page.getByText("当前：Jackey")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ 加成员", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "切换身份", exact: true }).click();
  await page.getByRole("dialog").getByLabel("小红", { exact: true }).check();
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByText("当前：小红")).toBeVisible();
});

test("AC4 reload remembers identity in same browser", async ({ page, browser }) => {
  const url = await createList(page, "周末读书会");
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await expect(page.getByText("当前：Jackey")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("当前：Jackey")).toBeVisible();

  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const fresh = await context.newPage();
  await fresh.goto(url);
  await expect(fresh.getByRole("dialog")).toBeVisible();
  await context.close();
});
