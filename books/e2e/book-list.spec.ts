import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function createList(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("书单名称").fill(name);
  await page.getByRole("button", { name: "创建书单" }).click();
  await expect(page).toHaveURL(/\/l\/[A-Za-z0-9_-]{22}$/);
  await expect(page.getByRole("dialog", { name: "选择「我是谁」" })).toBeVisible();
  return page.url();
}

async function addMemberOnGate(page: Page, name: string) {
  await page.getByLabel("成员名").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "加成员", exact: true }).click();
}

async function pickIdentityAndEnter(page: Page, name: string) {
  await page.getByRole("dialog").getByLabel(name, { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function grantClipboard(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
}

test("AC2 add and rename members", async ({ page }) => {
  await createList(page, "周末读书会");
  await addMemberOnGate(page, "阿明");
  await page.getByRole("dialog").getByLabel("阿明", { exact: true }).check();
  await page.getByRole("button", { name: "进入书单" }).click();

  await page.getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("小红");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await page.getByRole("button", { name: "+ 加成员", exact: true }).click();
  await page.getByLabel("成员名").fill("Jackey");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();

  await expect(page.getByRole("button", { name: "阿明", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "小红", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jackey", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "阿明", exact: true }).click();
  await page.getByLabel("成员名").fill("阿明哥");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("button", { name: "阿明哥", exact: true })).toBeVisible();
  await expect(page.getByText("当前：阿明哥")).toBeVisible();
});

test("AC1 copy link", async ({ page, context }) => {
  await grantClipboard(context);
  const url = await createList(page, "周末读书会");
  await addMemberOnGate(page, "Jackey");
  await pickIdentityAndEnter(page, "Jackey");
  await page.getByRole("button", { name: "复制链接", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已复制链接");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe(url);
});

test("AC6 no horizontal overflow on list page", async ({ page }) => {
  await createList(page, "周末读书会");
  await addMemberOnGate(page, "阿明");
  await pickIdentityAndEnter(page, "阿明");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
