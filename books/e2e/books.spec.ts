import { expect, test, type Page } from "@playwright/test";

async function createList(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("书单名称").fill(name);
  await page.getByRole("button", { name: "创建书单" }).click();
  await expect(page).toHaveURL(/\/l\/[A-Za-z0-9_-]{22}$/);
}

async function enterAsJackey(page: Page) {
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await expect(page.getByText("当前：Jackey")).toBeVisible();
}

test("AC1 add book and rate 3", async ({ page }) => {
  await createList(page, "周末读书会");
  await enterAsJackey(page);

  await page.getByLabel("书名").fill("三体");
  await page.getByRole("button", { name: "3 · 必读", exact: true }).click();
  await page.getByRole("button", { name: "加书", exact: true }).click();

  await expect(page.getByRole("button", { name: /三体/ })).toContainText("我的评分：必读");
});

test("AC2 change and revoke rating", async ({ page }) => {
  await createList(page, "周末读书会");
  await enterAsJackey(page);

  await page.getByLabel("书名").fill("三体");
  await page.getByRole("button", { name: "3 · 必读", exact: true }).click();
  await page.getByRole("button", { name: "加书", exact: true }).click();
  await expect(page.getByText("我的评分：必读")).toBeVisible();

  await page.getByRole("button", { name: /三体/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "2 · 推荐阅读", exact: true }).click();
  await expect(page.getByText("我的评分：推荐阅读")).toBeVisible();

  await page.getByRole("button", { name: /三体/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "撤销评分", exact: true }).click();
  await expect(page.getByText("未评分")).toBeVisible();
  await expect(page.getByRole("button", { name: /三体/ })).toBeVisible();
});

test("AC3 title dedupe", async ({ page }) => {
  await createList(page, "周末读书会");
  await enterAsJackey(page);

  await page.getByLabel("书名").fill("三体");
  await page.getByRole("button", { name: "加书", exact: true }).click();
  await expect(page.getByRole("button", { name: /三体/ })).toBeVisible();

  await page.getByLabel("书名").fill("  三体  ");
  await page.getByRole("button", { name: "2 · 推荐阅读", exact: true }).click();
  await page.getByRole("button", { name: "加书", exact: true }).click();

  await expect(page.locator(".book-list").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /三体/ })).toContainText("我的评分：推荐阅读");
});

test("AC6 identity gate blocks add book", async ({ page }) => {
  await createList(page, "周末读书会");
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "选择「我是谁」" })).toBeVisible();
  await expect(page.getByLabel("书名")).toBeDisabled();
  await expect(page.locator('button.primary:has-text("加书")')).toBeDisabled();
});

test("AC4 independent scores for two members", async ({ page, browser }) => {
  await createList(page, "周末读书会");
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("小红");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();

  await page.getByLabel("书名").fill("三体");
  await page.getByRole("button", { name: "3 · 必读", exact: true }).click();
  await page.getByRole("button", { name: "加书", exact: true }).click();
  await expect(page.getByText("我的评分：必读")).toBeVisible();

  const url = page.url();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const other = await context.newPage();
  await other.goto(url);
  await other.getByRole("dialog").getByLabel("小红", { exact: true }).check();
  await other.getByRole("button", { name: "进入书单" }).click();
  await other.getByRole("button", { name: /三体/ }).click();
  await other.getByRole("dialog").getByRole("button", { name: "1 · 无聊再读", exact: true }).click();
  await expect(other.getByText("我的评分：无聊再读")).toBeVisible();
  await context.close();

  await page.reload();
  await expect(page.getByText("当前：Jackey")).toBeVisible();
  await expect(page.getByText("我的评分：必读")).toBeVisible();
});
