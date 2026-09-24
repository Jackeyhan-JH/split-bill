import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function createGathering(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("饭局名称").fill(name);
  await page.getByRole("button", { name: "创建饭局" }).click();
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
  return page.url();
}

async function addPerson(page: Page, name: string) {
  await page.getByRole("button", { name: "+ 加人", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "加人", exact: true })).toBeVisible();
  await page.getByLabel("人名").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("已保存");
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

async function seedExpense(
  request: APIRequestContext,
  gatheringId: string,
  payerParticipantId: number,
  splitterParticipantIds: number[],
) {
  const response = await request.post(`/api/gatherings/${gatheringId}/test/expenses`, {
    data: { payerParticipantId, splitterParticipantIds },
  });
  expect(response.ok()).toBe(true);
}

test("issue 3 AC1–AC4 add people", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "小明");
  await addPerson(page, "小红");
  await addPerson(page, "小刚");

  const tags = page.locator(".people-row .person-tag");
  await expect(tags).toHaveText(["小明", "小红", "小刚"]);

  await page.getByRole("button", { name: "+ 加人", exact: true }).click();
  await page.getByLabel("人名").fill("   ");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("请填写人名");

  await page.getByLabel("人名").fill("小明");
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("这个名字已经有了");
});

test("issue 3 AC5–AC7 rename and delete", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "小明");
  await addPerson(page, "小红");
  await addPerson(page, "小刚");

  await page.getByRole("button", { name: "小红", exact: true }).click();
  await expect(page.getByRole("heading", { name: "管理此人", exact: true })).toBeVisible();
  await page.getByLabel("人名").fill("小虹");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("button", { name: "小虹", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "小虹", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "小虹", exact: true }).click();
  await page.getByLabel("人名").fill("小明");
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("这个名字已经有了");

  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "小刚", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除此人", exact: true }).click();
  await expect(page.getByText('确定删除「小刚」？')).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("button", { name: "小刚", exact: true })).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "删除此人", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByRole("button", { name: "小刚", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "小刚", exact: true })).toHaveCount(0);
});

test("issue 3 AC8 delete blocked when person is on an expense", async ({ page, request }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "小明");
  await addPerson(page, "小红");

  const gatheringId = new URL(page.url()).pathname.split("/").at(-1)!;
  const listed = await request.get(`/api/gatherings/${gatheringId}/participants`);
  const { participants } = (await listed.json()) as {
    participants: { id: number; name: string }[];
  };
  const xiaoMing = participants.find((person) => person.name === "小明")!;
  const xiaoHong = participants.find((person) => person.name === "小红")!;
  await seedExpense(request, gatheringId, xiaoMing.id, [xiaoMing.id, xiaoHong.id]);

  await page.reload();
  await page.getByRole("button", { name: "小明", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除此人", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "这个人已出现在账目中，请先改账再删除",
  );
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("button", { name: "小明", exact: true })).toBeVisible();
});

test("issue 3 AC9 another context sees participants after refresh", async ({ page, browser }) => {
  const url = await createGathering(page, "周五火锅");
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const fresh = await context.newPage();
  await fresh.goto(url);
  await expect(fresh.getByRole("button", { name: "小明", exact: true })).toHaveCount(0);

  await addPerson(page, "小明");
  await addPerson(page, "小红");

  await fresh.reload();
  await expect(fresh.getByRole("button", { name: "小明", exact: true })).toBeVisible();
  await expect(fresh.getByRole("button", { name: "小红", exact: true })).toBeVisible();
  await context.close();
});

test("toast clears when opening add-person so 确定 is not covered", async ({ page }) => {
  await createGathering(page, "周五火锅");
  await addPerson(page, "小明");
  await expect(page.getByRole("status")).toHaveText("已保存");

  await page.getByRole("button", { name: "+ 加人", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  const confirm = page.getByRole("dialog").getByRole("button", { name: "确定", exact: true });
  await expect(confirm).toBeVisible();
  const box = await confirm.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
});

test("issue 1 AC6–AC8 person panel targets and text size", async ({ page }) => {
  await createGathering(page, "周五火锅");
  const addPersonButton = page.getByRole("button", { name: "+ 加人", exact: true });
  await expectBoxAtLeast44(addPersonButton);
  await addPersonButton.click();
  const inputSize = await page.getByLabel("人名").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(inputSize).toBeGreaterThanOrEqual(16);
  await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();

  await addPerson(page, "小明");
  await expectBoxAtLeast44(page.getByRole("button", { name: "小明", exact: true }));
  await page.getByRole("button", { name: "小明", exact: true }).click();
  await expect(page.getByRole("heading", { name: "管理此人", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "删除此人", exact: true })).toBeVisible();
});

async function expectBoxAtLeast44(locator: ReturnType<Page["getByRole"]>) {
  const box = await locator.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
}
