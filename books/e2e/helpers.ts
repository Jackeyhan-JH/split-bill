import type { Locator, Page } from "@playwright/test";

/** Book title row on the collective shelf (excludes adjacent delete buttons). */
export function collectiveBookRow(root: Page | Locator, title: string): Locator {
  return root.locator(".book-list .book-row").filter({ hasText: title });
}
