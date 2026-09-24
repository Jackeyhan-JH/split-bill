import { expect, test } from "@playwright/test";

test("favicon.ico returns 200", async ({ request }) => {
  const response = await request.get("/favicon.ico");
  expect(response.status()).toBe(200);
});
