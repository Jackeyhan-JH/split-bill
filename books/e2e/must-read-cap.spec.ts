import { expect, test, type Page } from "@playwright/test";

const FIVE = ["三体", "活着", "百年孤独", "人类简史", "红楼梦"] as const;

async function createList(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("书单名称").fill(name);
  await page.getByRole("button", { name: "创建书单" }).click();
  await expect(page).toHaveURL(/\/l\/[A-Za-z0-9_-]{22}$/);
}

async function enterAs(page: Page, name: string) {
  await page.getByLabel("成员名").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
  await page.getByRole("dialog").getByLabel(name, { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await expect(page.getByText(`当前：${name}`)).toBeVisible();
}

async function addBookWithScore(page: Page, title: string, score?: 1 | 2 | 3) {
  const booksSection = page.locator("section[aria-labelledby='books-heading']");
  await booksSection.getByLabel("书名").fill(title);
  if (score !== undefined) {
    const label =
      score === 3 ? "3 · 必读" : score === 2 ? "2 · 推荐阅读" : "1 · 无聊再读";
    await booksSection.getByRole("button", { name: label, exact: true }).click();
  }
  await booksSection.getByRole("button", { name: "加书", exact: true }).click();
  const row = page.getByRole("button", { name: new RegExp(title) });
  await expect(row).toBeVisible();
  if (score === 3) {
    await expect(row).toContainText("必读");
  } else if (score === 2) {
    await expect(row).toContainText("推荐阅读");
  } else if (score === 1) {
    await expect(row).toContainText("无聊再读");
  }
}

test("AC4 my must-read counter 0/5 and 5/5", async ({ page }) => {
  await createList(page, "周末读书会");
  await enterAs(page, "Jackey");
  await expect(page.getByText("我的必读 0/5")).toBeVisible();

  for (const title of FIVE) {
    await addBookWithScore(page, title, 3);
  }
  await expect(page.getByText("我的必读 5/5")).toBeVisible();
});

test("AC1 block 6th must-read with title list", async ({ page }) => {
  await createList(page, "周末读书会");
  await enterAs(page, "Jackey");

  for (const title of FIVE) {
    await addBookWithScore(page, title, 3);
  }
  await addBookWithScore(page, "围城", 2);

  await page.getByRole("button", { name: /围城/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "3 · 必读", exact: true }).click();

  const alert = page.getByRole("dialog").getByRole("alert");
  await expect(alert).toContainText("最多 5 本必读");
  for (const title of FIVE) {
    await expect(alert).toContainText(title);
  }
  await expect(page.getByRole("button", { name: /围城/ })).toContainText("推荐阅读");
});

test("AC2 demote then add 6th must-read", async ({ page }) => {
  await createList(page, "周末读书会");
  await enterAs(page, "Jackey");

  for (const title of FIVE) {
    await addBookWithScore(page, title, 3);
  }
  await addBookWithScore(page, "围城", 2);

  await page.getByRole("button", { name: /红楼梦/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "2 · 推荐阅读", exact: true }).click();
  await expect(page.getByText("我的必读 4/5")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: /围城/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "3 · 必读", exact: true }).click();
  await expect(page.getByText("我的必读 5/5")).toBeVisible();
  await expect(page.getByRole("button", { name: /围城/ })).toContainText("必读");
  await expect(page.getByRole("button", { name: /红楼梦/ })).toContainText("推荐阅读");
});

test("AC3 demote at cap is not blocked", async ({ page }) => {
  await createList(page, "周末读书会");
  await enterAs(page, "Jackey");

  for (const title of FIVE) {
    await addBookWithScore(page, title, 3);
  }

  await page.getByRole("button", { name: /三体/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "2 · 推荐阅读", exact: true }).click();
  await expect(page.getByText("我的必读 4/5")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("AC6 小红 independent cap", async ({ page, browser }) => {
  await createList(page, "周末读书会");
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("小红");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await expect(page.getByText("当前：Jackey")).toBeVisible();

  for (const title of FIVE) {
    await addBookWithScore(page, title, 3);
  }

  const url = page.url();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const other = await context.newPage();
  await other.goto(url);
  await other.getByRole("dialog").getByLabel("小红", { exact: true }).check();
  await other.getByRole("button", { name: "进入书单" }).click();
  await addBookWithScore(other, "三体", 3);
  await expect(other.getByText("我的必读 1/5")).toBeVisible();
  await context.close();
});
