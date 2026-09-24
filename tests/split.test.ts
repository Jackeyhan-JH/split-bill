import { computeShareCents } from "@/lib/split";
import { describe, expect, test } from "vitest";

describe("computeShareCents", () => {
  test("AC1 HK$300 split three ways", () => {
    const shares = computeShareCents(30000, [1, 2, 3], 1);
    expect(shares.get(1)).toBe(10000);
    expect(shares.get(2)).toBe(10000);
    expect(shares.get(3)).toBe(10000);
  });

  test("AC2 remainder to payer when payer is sharee", () => {
    const shares = computeShareCents(10000, [1, 2, 3], 1);
    expect(shares.get(1)).toBe(3334);
    expect(shares.get(2)).toBe(3333);
    expect(shares.get(3)).toBe(3333);
  });

  test("AC3 payer excluded — equal split", () => {
    const shares = computeShareCents(10000, [2, 3], 1);
    expect(shares.get(2)).toBe(5000);
    expect(shares.get(3)).toBe(5000);
    expect(shares.has(1)).toBe(false);
  });

  test("AC3 HK$100.01 to earliest sharee B", () => {
    const shares = computeShareCents(10001, [2, 3], 1);
    expect(shares.get(2)).toBe(5001);
    expect(shares.get(3)).toBe(5000);
  });
});
