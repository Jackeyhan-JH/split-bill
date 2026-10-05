import { expect, test, type Page } from "@playwright/test";

async function createList(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("书单名称").fill(name);
  await page.getByRole("button", { name: "创建书单" }).click();
  await expect(page).toHaveURL(/\/l\/[A-Za-z0-9_-]{22}$/);
}

async function addMemberOnGate(page: Page, name: string) {
  await page.getByLabel("成员名").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
}

async function enterList(page: Page, memberName: string) {
  await page.getByRole("dialog").getByLabel(memberName, { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await expect(page.getByText(`当前：${memberName}`)).toBeVisible();
}

async function seedThreeMembers(page: Page) {
  await createList(page, "删书验收");
  await addMemberOnGate(page, "阿明");
  await page.getByRole("dialog").getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("小红");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await enterList(page, "Jackey");
}

async function addBook(page: Page, title: string, score?: 1 | 2 | 3) {
  await page.getByRole("tab", { name: "集体" }).click();
  const section = page.locator("section[aria-labelledby='books-heading']");
  await section.getByLabel("书名").fill(title);
  if (score !== undefined) {
    const label =
      score === 3 ? "3 · 必读" : score === 2 ? "2 · 推荐阅读" : "1 · 无聊再读";
    await section.getByRole("button", { name: label, exact: true }).click();
  }
  await section.getByRole("button", { name: "加书", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  await expect(section.locator(".book-list .book-row").filter({ hasText: title })).toBeVisible();
}

async function rateAsMember(page: Page, memberName: string, title: string, score: 1 | 2 | 3) {
  await page.getByRole("button", { name: "切换身份" }).click();
  await page.getByRole("dialog").getByLabel(memberName, { exact: true }).check();
  await page.getByRole("button", { name: "确定", exact: true }).click();
  await page.getByRole("tab", { name: "集体" }).click();
  const section = page.locator("section[aria-labelledby='books-heading']");
  await section.locator(".book-list .book-row").filter({ hasText: title }).click();
  const label =
    score === 3 ? "3 · 必读" : score === 2 ? "2 · 推荐阅读" : "1 · 无聊再读";
  await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
}

test("AC1 confirm shows rater count for three members", async ({ page }) => {
  await seedThreeMembers(page);
  await addBook(page, "三体", 3);
  await rateAsMember(page, "阿明", "三体", 1);
  await rateAsMember(page, "小红", "三体", 2);
  await page.getByRole("button", { name: "切换身份" }).click();
  await page.getByRole("dialog").getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "确定", exact: true }).click();

  await page.getByRole("button", { name: "删书：三体", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "删除此书" })).toContainText(
    "《三体》已有 3 人打分，删除后这些分数一起清掉",
  );
});

test("AC2 cancel keeps book and ratings", async ({ page }) => {
  await seedThreeMembers(page);
  await addBook(page, "三体", 3);
  await rateAsMember(page, "阿明", "三体", 1);
  await rateAsMember(page, "小红", "三体", 2);
  await page.getByRole("button", { name: "切换身份" }).click();
  await page.getByRole("dialog").getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "确定", exact: true }).click();

  await page.getByRole("button", { name: "删书：三体", exact: true }).click();
  await page.getByRole("dialog", { name: "删除此书" }).getByRole("button", { name: "取消" }).click();

  const section = page.locator("section[aria-labelledby='books-heading']");
  const santiRow = section.locator(".book-list .book-row").filter({ hasText: "三体" });
  await expect(santiRow).toBeVisible();
  await expect(santiRow).toContainText("必读(3)：Jackey");
  await expect(santiRow).toContainText("无聊再读(1)：阿明");
  await expect(santiRow).toContainText("推荐阅读(2)：小红");
});

test("AC3 confirm delete removes book from collective and personal shelves", async ({ page }) => {
  await seedThreeMembers(page);
  await addBook(page, "三体", 3);
  await rateAsMember(page, "阿明", "三体", 1);
  await rateAsMember(page, "小红", "三体", 2);
  await page.getByRole("button", { name: "切换身份" }).click();
  await page.getByRole("dialog").getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "确定", exact: true }).click();

  await page.getByRole("button", { name: "删书：三体", exact: true }).click();
  await page.getByRole("dialog", { name: "删除此书" }).getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("status")).toContainText("已保存");

  const section = page.locator("section[aria-labelledby='books-heading']");
  await expect(section.locator(".book-list")).toHaveCount(0);

  for (const tab of ["阿明", "小红", "Jackey（我）"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByText(/还没给任何书打分/)).toBeVisible();
  }
});

const FIVE_MUST_READ = ["三体", "活着", "百年孤独", "人类简史", "红楼梦"] as const;

test("AC4 must-read badge drops and 围城 can be rated 3 after deleting 三体", async ({ page }) => {
  await seedThreeMembers(page);
  for (const title of FIVE_MUST_READ) {
    await addBook(page, title, 3);
  }
  await expect(page.locator(".must-read-badge")).toHaveText("我的必读 5/5");

  await page.getByRole("button", { name: "删书：三体", exact: true }).click();
  await page.getByRole("dialog", { name: "删除此书" }).getByRole("button", { name: "确认删除" }).click();
  await expect(page.locator(".must-read-badge")).toHaveText("我的必读 4/5");

  await addBook(page, "围城", 2);
  const section = page.locator("section[aria-labelledby='books-heading']");
  await section.locator(".book-list .book-row").filter({ hasText: "围城" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "3 · 必读", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  await expect(page.locator(".must-read-badge")).toHaveText("我的必读 5/5");
});

test("AC5 re-add same title after delete has no scores", async ({ page }) => {
  await seedThreeMembers(page);
  await addBook(page, "三体", 3);
  await page.getByRole("button", { name: "删书：三体", exact: true }).click();
  await page.getByRole("dialog", { name: "删除此书" }).getByRole("button", { name: "确认删除" }).click();

  await addBook(page, "三体");
  const section = page.locator("section[aria-labelledby='books-heading']");
  await expect(section.getByText("未评分")).toBeVisible();
});

test("AC6 no delete without identity on gate", async ({ page }) => {
  await createList(page, "无身份删书");
  await addMemberOnGate(page, "Jackey");
  await page.getByLabel("Jackey", { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await addBook(page, "三体", 3);
  await page.getByRole("button", { name: "切换身份" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "取消" }).click();

  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByRole("dialog", { name: "选择「我是谁」" })).toBeVisible();
  await expect(page.getByRole("button", { name: "删书：三体" })).toHaveCount(0);
});

test("AC7 delete confirm and cancel fit mobile viewport", async ({ page }) => {
  await seedThreeMembers(page);
  await addBook(page, "三体");
  await page.getByRole("button", { name: "删书：三体", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "删除此书" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("《三体》已有 0 人打分");
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await dialog.getByRole("button", { name: "取消" }).click();
});
