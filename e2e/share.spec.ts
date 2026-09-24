import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function createGathering(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("饭局名称").fill(name);
  await page.getByRole("button", { name: "创建饭局" }).click();
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
  return page.url();
}

async function grantClipboard(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
}

test.describe("issue 6 share link", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("AC1 copy link writes URL and shows toast", async ({ page, context }) => {
    await grantClipboard(context);
    const url = await createGathering(page, "周五火锅");
    await page.getByRole("button", { name: "复制链接", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("已复制链接");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(url);
    expect(new URL(clip).pathname).toBe(new URL(url).pathname);
  });

  test("AC2 share without navigator.share falls back to copy", async ({ page, context }) => {
    await grantClipboard(context);
    const url = await createGathering(page, "分享测试");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "分享测试", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "分享", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("已复制链接");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(url);
  });

  test("AC3 cancelled share leaves page unchanged", async ({ page }) => {
    await createGathering(page, "取消分享");
    await page.addInitScript(() => {
      navigator.share = async () => {
        throw new DOMException("User cancelled", "AbortError");
      };
    });
    await page.reload();
    await expect(page.getByText("还没有参与人")).toBeVisible();
    await page.getByRole("button", { name: "分享", exact: true }).click();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "取消分享", exact: true })).toBeVisible();
  });

  test("AC4 guest opens link without auth wall", async ({ page, browser }) => {
    const url = await createGathering(page, "访客饭局");
    await page.getByRole("button", { name: "+ 加人", exact: true }).click();
    await page.getByLabel("人名").fill("小明");
    await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("已保存");

    const guest = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const guestPage = await guest.newPage();
    await guestPage.goto(url);
    await expect(guestPage.getByRole("heading", { level: 1, name: "访客饭局", exact: true })).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "小明", exact: true })).toBeVisible();
    await expect(guestPage.getByText("结算")).toBeVisible();
    await expect(guestPage.getByRole("button", { name: /登录|注册/ })).toHaveCount(0);
    await guest.close();
  });

  test("AC5 guest can add person and host sees after refresh", async ({ page, browser }) => {
    const url = await createGathering(page, "协作饭局");
    const guest = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const guestPage = await guest.newPage();
    await guestPage.goto(url);
    await guestPage.getByRole("button", { name: "+ 加人", exact: true }).click();
    await guestPage.getByLabel("人名").fill("小红");
    await guestPage.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
    await expect(guestPage.getByRole("status")).toHaveText("已保存");
    await expect(guestPage.getByRole("button", { name: "小红", exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "小红", exact: true })).toBeVisible();
    await guest.close();
  });

  test("AC6 copied URL matches address bar and loads same gathering", async ({ page, context, browser }) => {
    await grantClipboard(context);
    await createGathering(page, "链接一致");
    await page.getByRole("button", { name: "复制链接", exact: true }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(page.url());

    const other = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const otherPage = await other.newPage();
    await otherPage.goto(clip);
    await expect(otherPage.getByRole("heading", { level: 1, name: "链接一致", exact: true })).toBeVisible();
    await expect(otherPage).not.toHaveURL("/");
    await other.close();
  });
});
