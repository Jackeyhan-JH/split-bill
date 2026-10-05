import { expect, test } from "@playwright/test";

test("AC5 invalid list id shows not found copy", async ({ page }) => {
  await page.goto("/l/not-a-real-list-id");
  await expect(page.getByRole("heading", { name: "找不到这个书单" })).toBeVisible();
  await expect(page.getByText("链接可能打错了，或书单不存在")).toBeVisible();
  await expect(page.getByRole("link", { name: "回首页" })).toBeVisible();
  await expect(page.getByText("周末读书会")).toHaveCount(0);
});
