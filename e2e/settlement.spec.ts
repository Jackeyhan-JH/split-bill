import { expect, test, type Page } from "@playwright/test";

async function createGathering(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("饭局名称").fill(name);
  await page.getByRole("button", { name: "创建饭局" }).click();
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
  return page.url();
}

async function addPerson(page: Page, name: string) {
  await page.getByRole("button", { name: "+ 加人", exact: true }).click();
  await page.getByLabel("人名").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
}

async function addExpense(page: Page, description: string, amount: string, payerIndex: number) {
  await page.getByRole("button", { name: "记一笔", exact: true }).click();
  await page.getByLabel("说明").fill(description);
  await page.getByLabel("金额").fill(amount);
  await page.getByRole("dialog").locator('input[type="radio"]').nth(payerIndex).check();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
}

test.describe("issue 5 settlement", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("AC1 shows net amounts and minimum transfers", async ({ page }) => {
    await createGathering(page, "周五火锅");
    await addPerson(page, "A");
    await addPerson(page, "B");
    await addPerson(page, "C");
    await addExpense(page, "烧烤", "300", 0);

    const settlement = page.locator("section.settlement");
    await expect(settlement.getByRole("columnheader", { name: "净额" })).toBeVisible();
    await expect(settlement.locator("tbody tr").nth(0).locator(".net")).toHaveText("+HK$200.00");
    await expect(settlement.locator("tbody tr").nth(1).locator(".net")).toHaveText("-HK$100.00");
    await expect(settlement.locator("tbody tr").nth(2).locator(".net")).toHaveText("-HK$100.00");

    const outcome = page.getByTestId("settlement-outcome");
    await expect(outcome.getByText("B 转 HK$100.00 给 A")).toBeVisible();
    await expect(outcome.getByText("C 转 HK$100.00 给 A")).toBeVisible();

    const firstTransfer = outcome.locator("li").first();
    const box = await firstTransfer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  });

  test("AC5 settled message without transfer rows", async ({ page }) => {
    await createGathering(page, "两清");
    await addPerson(page, "A");
    await addPerson(page, "B");
    await addExpense(page, "A付", "50", 0);
    await addExpense(page, "B付", "50", 1);

    const outcome = page.getByTestId("settlement-outcome");
    await expect(outcome.getByText("已经两清，不需要转账")).toBeVisible();
    await expect(outcome.locator("li")).toHaveCount(0);

    const settled = outcome.getByText("已经两清，不需要转账");
    const box = await settled.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  });

  test("AC8 no expenses shows empty settlement copy", async ({ page }) => {
    await createGathering(page, "空账");
    await addPerson(page, "A");
    await expect(page.getByTestId("settlement-outcome")).toHaveText("还没有账目");
    await expect(page.locator(".settlement-table")).toHaveCount(0);

    const text = await page.locator("main").innerText();
    const parts = ["空账", "参与人", "还没有账目，点下方「记一笔」", "结算", "还没有账目"];
    let cursor = 0;
    for (const part of parts) {
      const found = text.indexOf(part, cursor);
      expect(found, part).toBeGreaterThanOrEqual(0);
      cursor = found + part.length;
    }
  });

  test("updates settlement on same page after edit", async ({ page }) => {
    await createGathering(page, "更新");
    await addPerson(page, "A");
    await addPerson(page, "B");
    await addPerson(page, "C");
    await addExpense(page, "烧烤", "300", 0);
    await expect(page.getByText("B 转 HK$100.00 给 A")).toBeVisible();

    await page.locator(".expense-row").filter({ hasText: "烧烤" }).click();
    await page.getByLabel("金额").fill("90");
    await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("B 转 HK$100.00 给 A")).toHaveCount(0);

    await openSecondExpense(page);
    await page.getByLabel("说明").fill("饮料");
    await page.getByLabel("金额").fill("60");
    await page.getByRole("dialog").locator('input[type="radio"]').nth(1).check();
    await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();

    await expect(page.getByText("C 转 HK$40.00 给 A")).toBeVisible();
    await expect(page.getByText("C 转 HK$10.00 给 B")).toBeVisible();
  });
});

async function openSecondExpense(page: Page) {
  await page.getByRole("button", { name: "记一笔", exact: true }).click();
  await expect(page.getByRole("heading", { name: "记一笔", exact: true })).toBeVisible();
}
