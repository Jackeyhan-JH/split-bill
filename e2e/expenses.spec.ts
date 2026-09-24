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

async function openExpenseForm(page: Page) {
  await page.getByRole("button", { name: "记一笔", exact: true }).click();
  await expect(page.getByRole("heading", { name: "记一笔", exact: true })).toBeVisible();
}

test("issue 4 AC1 default sharees and equal split", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "A");
  await addPerson(page, "B");
  await addPerson(page, "C");

  await openExpenseForm(page);
  const checkboxes = page.getByRole("dialog").locator('input[type="checkbox"]');
  await expect(checkboxes).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(checkboxes.nth(index)).toBeChecked();
  }

  await page.getByLabel("说明").fill("烧烤");
  await page.getByLabel("金额").fill("300");
  await page.getByRole("dialog").locator('input[type="radio"]').first().check();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");

  const row = page.locator(".expense-row").filter({ hasText: "烧烤" });
  await expect(row.getByText("HK$300.00")).toBeVisible();
  await expect(row.getByText("HK$100.00")).toHaveCount(3);
});

test("issue 4 AC2 remainder on payer", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "A");
  await addPerson(page, "B");
  await addPerson(page, "C");

  await openExpenseForm(page);
  await page.getByLabel("说明").fill("饮料");
  await page.getByLabel("金额").fill("100");
  await page.getByRole("dialog").locator('input[type="radio"]').first().check();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();

  const row = page.locator(".expense-row").filter({ hasText: "饮料" });
  await expect(row.getByText("HK$33.34")).toHaveCount(1);
  await expect(row.getByText("HK$33.33")).toHaveCount(2);
});

test("issue 4 AC3 payer not in sharees", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "A");
  await addPerson(page, "B");
  await addPerson(page, "C");

  await openExpenseForm(page);
  await page.getByLabel("金额").fill("100");
  await page.getByLabel("说明").fill("仅BC");
  await page.getByRole("dialog").locator('input[type="radio"]').first().check();
  await page.getByRole("dialog").locator('input[type="checkbox"]').first().uncheck();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();

  let row = page.locator(".expense-row").filter({ hasText: "仅BC" });
  await expect(row.getByText("HK$50.00")).toHaveCount(2);

  await row.click();
  await expect(page.getByRole("heading", { name: "编辑账目", exact: true })).toBeVisible();
  await page.getByLabel("金额").fill("100.01");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  row = page.locator(".expense-row").filter({ hasText: "仅BC" });
  await expect(row.getByText("HK$50.01")).toHaveCount(1);
  await expect(row.getByText("HK$50.00")).toHaveCount(1);
});

test("issue 4 AC4–AC5 validation", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "A");
  await openExpenseForm(page);

  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("请填写说明");

  await page.getByLabel("说明").fill("x");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("请选择付款人");

  await page.getByRole("dialog").locator('input[type="radio"]').first().check();
  await page.getByRole("dialog").locator('input[type="checkbox"]').uncheck();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("请至少选择一个分摊人");

  await page.getByLabel("金额").fill("10.123");
  await page.getByRole("dialog").locator('input[type="checkbox"]').first().check();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("金额必须大于 0，最多两位小数");
});

test("issue 4 edit delete and layout order", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "A");
  await addPerson(page, "B");
  await addPerson(page, "C");

  await openExpenseForm(page);
  await page.getByLabel("说明").fill("烧烤");
  await page.getByLabel("金额").fill("300");
  await page.getByRole("dialog").locator('input[type="radio"]').first().check();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".expense-row").filter({ hasText: "烧烤" })).toBeVisible();
  await expect(page.locator("main section").first()).toHaveAttribute("aria-label", "结算");
  const sectionOrder = await page.locator("main section").evaluateAll((sections) =>
    sections.map((section) => section.getAttribute("aria-label") ?? section.querySelector("h2")?.textContent ?? ""),
  );
  expect(sectionOrder).toEqual(["结算", "参与人", "账目"]);

  await page.locator(".expense-row").filter({ hasText: "烧烤" }).click();
  await page.getByLabel("金额").fill("90");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".expense-row").getByText("HK$90.00")).toBeVisible();
  await page.reload();
  await expect(page.locator(".expense-row").getByText("HK$90.00")).toBeVisible();

  await openExpenseForm(page);
  await page.getByLabel("说明").fill("饮料");
  await page.getByLabel("金额").fill("100");
  await page.getByRole("dialog").locator('input[type="radio"]').first().check();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();

  await page.locator(".expense-row").filter({ hasText: "饮料" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除这笔账", exact: true }).click();
  await expect(page.getByText("确定删除这笔账？")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".expense-row").filter({ hasText: "饮料" })).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "删除这笔账", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.locator(".expense-row").filter({ hasText: "饮料" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".expense-row").filter({ hasText: "饮料" })).toHaveCount(0);
});

test("G13 disabled without participants", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await expect(page.getByRole("button", { name: "记一笔", exact: true })).toBeDisabled();
});

test("issue 4 AC9 another browser sees expenses", async ({ page, browser }) => {
  const url = await createGathering(page, "周五火锅");
  await addPerson(page, "A");

  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const fresh = await context.newPage();
  await fresh.goto(url);
  await expect(fresh.locator(".expense-row").filter({ hasText: "同步" })).toHaveCount(0);

  await openExpenseForm(page);
  await page.getByLabel("说明").fill("同步");
  await page.getByLabel("金额").fill("10");
  await page.getByRole("dialog").locator('input[type="radio"]').first().check();
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();

  await fresh.reload();
  await expect(fresh.locator(".expense-row").filter({ hasText: "同步" })).toBeVisible();
  await context.close();
});
