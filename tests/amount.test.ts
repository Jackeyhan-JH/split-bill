import { parseAmountCents } from "@/lib/amount";
import { copy } from "@/lib/copy";
import { describe, expect, test } from "vitest";

describe("parseAmountCents", () => {
  test("accepts valid amounts", () => {
    expect(parseAmountCents("100")).toEqual({ ok: true, cents: 10000 });
    expect(parseAmountCents("100.01")).toEqual({ ok: true, cents: 10001 });
    expect(parseAmountCents(90)).toEqual({ ok: true, cents: 9000 });
  });

  test("rejects invalid amounts AC4", () => {
    expect(parseAmountCents("0")).toEqual({ ok: false, error: copy.amountInvalid });
    expect(parseAmountCents("-5")).toEqual({ ok: false, error: copy.amountInvalid });
    expect(parseAmountCents("")).toEqual({ ok: false, error: copy.amountInvalid });
    expect(parseAmountCents("10.123")).toEqual({ ok: false, error: copy.amountInvalid });
  });
});
