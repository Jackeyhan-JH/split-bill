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

async function switchIdentity(page: Page, memberName: string) {
  await page.getByRole("button", { name: "切换身份" }).click();
  await page.getByRole("dialog").getByLabel(memberName, { exact: true }).check();
  await page.getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByText(`当前：${memberName}`)).toBeVisible();
}

async function seedFixture(page: Page) {
  await createList(page, "AC3 书架");
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
  await expect(
    section.locator(".book-list").getByRole("button", { name: new RegExp(title) }),
  ).toBeVisible();
}

async function rateOnCollective(page: Page, title: string, score: 1 | 2 | 3) {
  await page.getByRole("tab", { name: "集体" }).click();
  const section = page.locator("section[aria-labelledby='books-heading']");
  await section.locator(".book-list").getByRole("button", { name: new RegExp(title) }).click();
  const label =
    score === 3 ? "3 · 必读" : score === 2 ? "2 · 推荐阅读" : "1 · 无聊再读";
  await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
}

test("AC1 tabs order and default collective", async ({ page }) => {
  await seedFixture(page);
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(tabs.nth(0)).toHaveText("集体");
  await expect(tabs.nth(1)).toHaveText("阿明");
  await expect(tabs.nth(2)).toHaveText("小红");
  await expect(tabs.nth(3)).toHaveText("Jackey（我）");
  await expect(tabs.nth(0)).toHaveClass(/is-active/);
  await expect(page.getByRole("heading", { name: "集体书架" })).toBeVisible();
});

test("AC2 me marker follows identity switch", async ({ page }) => {
  await seedFixture(page);
  await switchIdentity(page, "小红");
  await expect(page.getByRole("tab", { name: "小红（我）" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Jackey（我）/ })).toHaveCount(0);
});

test("AC3 collective sort and tier display", async ({ page }) => {
  await seedFixture(page);
  await addBook(page, "三体", 3);
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "三体", 3);
  await switchIdentity(page, "阿明");
  await rateOnCollective(page, "三体", 2);
  await switchIdentity(page, "Jackey");
  await addBook(page, "活着", 3);
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "活着", 1);
  await switchIdentity(page, "Jackey");
  await addBook(page, "围城", 2);
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "围城", 2);
  await switchIdentity(page, "Jackey");
  await addBook(page, "红楼梦", 1);
  await addBook(page, "聊斋");
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "聊斋", 1);
  await switchIdentity(page, "Jackey");

  await page.getByRole("tab", { name: "集体" }).click();
  const titles = page.locator(".book-list .book-title");
  await expect(titles).toHaveText(["三体", "活着", "围城", "红楼梦", "聊斋"]);
  await expect(page.getByRole("button", { name: /三体/ })).toContainText("必读(3)：小红、Jackey");
  await expect(page.getByRole("button", { name: /三体/ })).toContainText("推荐阅读(2)：阿明");
});

test("AC4 personal shelf groups for 小红", async ({ page }) => {
  await seedFixture(page);
  await addBook(page, "三体", 3);
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "三体", 3);
  await switchIdentity(page, "Jackey");
  await addBook(page, "围城", 2);
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "围城", 2);
  await switchIdentity(page, "Jackey");
  await addBook(page, "聊斋");
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "聊斋", 1);
  await switchIdentity(page, "Jackey");
  await addBook(page, "活着", 1);
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "活着", 1);

  await switchIdentity(page, "小红");
  await page.getByRole("tab", { name: "小红（我）" }).click();
  await expect(page.getByRole("heading", { name: "小红的书架" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "必读 1/5", exact: true })).toBeVisible();
  await expect(page.locator("#group-3 .book-title")).toHaveText(["三体"]);
  await expect(page.locator("#group-2 .book-title")).toHaveText(["围城"]);
  await expect(page.locator("#group-1 .book-title")).toHaveText(["活着", "聊斋"]);
});

test("AC5 empty group and member with no ratings", async ({ page }) => {
  await seedFixture(page);
  await addBook(page, "三体", 3);
  await page.getByRole("tab", { name: "阿明" }).click();
  await expect(page.getByText("阿明 还没给任何书打分")).toBeVisible();
  await page.getByRole("tab", { name: "Jackey（我）" }).click();
  await expect(page.getByRole("heading", { name: "推荐阅读", exact: true })).toBeVisible();
  await expect(page.getByText("暂无").first()).toBeVisible();
});

test("AC6 own shelf editable, other shelf read-only", async ({ page }) => {
  await seedFixture(page);
  await addBook(page, "三体", 3);
  await switchIdentity(page, "小红");
  await rateOnCollective(page, "三体", 3);
  await page.getByRole("tab", { name: "Jackey" }).click();
  await expect(page.locator(".book-row.is-readonly")).toHaveCount(1);
  await expect(page.locator("button.book-row")).toHaveCount(0);
  await page.getByRole("tab", { name: "小红（我）" }).click();
  await page.locator("#group-3 button.book-row").click();
  await expect(page.getByRole("dialog", { name: "给书打分" })).toBeVisible();
});

test("AC1 horizontal scroll reaches last tab with many members", async ({ page }) => {
  await createList(page, "多成员");
  await addMemberOnGate(page, "阿明");
  for (let index = 0; index < 8; index += 1) {
    await page.getByRole("dialog").getByRole("button", { name: "+ 加成员", exact: true }).click();
    await page.getByLabel("成员名").fill(`成员${index}`);
    await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  }
  await enterList(page, "阿明");
  const lastTab = page.getByRole("tab").last();
  await lastTab.scrollIntoViewIfNeeded();
  await expect(lastTab).toBeInViewport();
});
