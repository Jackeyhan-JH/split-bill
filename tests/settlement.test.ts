import {
  computeSettlement,
  formatTransferLine,
  type SettlementExpense,
  type SettlementParticipant,
} from "@/lib/settlement";
import { describe, expect, test } from "vitest";

function people(names: string[]): SettlementParticipant[] {
  return names.map((name, index) => ({ id: index + 1, name }));
}

function expense(
  payerId: number,
  amountCents: number,
  shares: { participantId: number; amountCents: number }[],
): SettlementExpense {
  return { payerParticipantId: payerId, amountCents, shares };
}

describe("computeSettlement", () => {
  test("AC1 three people one expense", () => {
    const participants = people(["A", "B", "C"]);
    const expenses = [
      expense(1, 30000, [
        { participantId: 1, amountCents: 10000 },
        { participantId: 2, amountCents: 10000 },
        { participantId: 3, amountCents: 10000 },
      ]),
    ];
    const result = computeSettlement(participants, expenses);
    expect(result.summaries.map((row) => [row.name, row.paidCents, row.owedCents, row.netCents])).toEqual([
      ["A", 30000, 10000, 20000],
      ["B", 0, 10000, -10000],
      ["C", 0, 10000, -10000],
    ]);
    expect(result.transfers.map((t) => formatTransferLine(t.fromName, t.amountCents, t.toName))).toEqual([
      "B 转 HK$100.00 给 A",
      "C 转 HK$100.00 给 A",
    ]);
    expect(result.allSettled).toBe(false);
  });

  test("AC2 three people two expenses", () => {
    const participants = people(["A", "B", "C"]);
    const expenses = [
      expense(1, 9000, [
        { participantId: 1, amountCents: 3000 },
        { participantId: 2, amountCents: 3000 },
        { participantId: 3, amountCents: 3000 },
      ]),
      expense(2, 6000, [
        { participantId: 1, amountCents: 2000 },
        { participantId: 2, amountCents: 2000 },
        { participantId: 3, amountCents: 2000 },
      ]),
    ];
    const result = computeSettlement(participants, expenses);
    expect(result.summaries.map((row) => row.netCents)).toEqual([4000, 1000, -5000]);
    expect(result.transfers.map((t) => formatTransferLine(t.fromName, t.amountCents, t.toName))).toEqual([
      "C 转 HK$40.00 给 A",
      "C 转 HK$10.00 给 B",
    ]);
  });

  test("AC3 four people two expenses with remainder on payer B", () => {
    const participants = people(["A", "B", "C", "D"]);
    const expenses = [
      expense(1, 40000, [
        { participantId: 1, amountCents: 10000 },
        { participantId: 2, amountCents: 10000 },
        { participantId: 3, amountCents: 10000 },
        { participantId: 4, amountCents: 10000 },
      ]),
      expense(2, 20000, [
        { participantId: 2, amountCents: 6668 },
        { participantId: 3, amountCents: 6666 },
        { participantId: 4, amountCents: 6666 },
      ]),
    ];
    const result = computeSettlement(participants, expenses);
    expect(result.summaries.map((row) => [row.name, row.netCents])).toEqual([
      ["A", 30000],
      ["B", 3332],
      ["C", -16666],
      ["D", -16666],
    ]);
    expect(result.transfers.map((t) => formatTransferLine(t.fromName, t.amountCents, t.toName))).toEqual([
      "C 转 HK$166.66 给 A",
      "D 转 HK$133.34 给 A",
      "D 转 HK$33.32 给 B",
    ]);
    expect(result.transfers.length).toBe(3);
  });

  test("AC4 remainder on payer A", () => {
    const participants = people(["A", "B", "C"]);
    const expenses = [
      expense(1, 10000, [
        { participantId: 1, amountCents: 3334 },
        { participantId: 2, amountCents: 3333 },
        { participantId: 3, amountCents: 3333 },
      ]),
    ];
    const result = computeSettlement(participants, expenses);
    expect(result.summaries.map((row) => row.netCents)).toEqual([6666, -3333, -3333]);
    expect(result.transfers.map((t) => formatTransferLine(t.fromName, t.amountCents, t.toName))).toEqual([
      "B 转 HK$33.33 给 A",
      "C 转 HK$33.33 给 A",
    ]);
  });

  test("AC5 all settled after balanced payments", () => {
    const participants = people(["A", "B"]);
    const expenses = [
      expense(1, 5000, [
        { participantId: 1, amountCents: 2500 },
        { participantId: 2, amountCents: 2500 },
      ]),
      expense(2, 5000, [
        { participantId: 1, amountCents: 2500 },
        { participantId: 2, amountCents: 2500 },
      ]),
    ];
    const result = computeSettlement(participants, expenses);
    expect(result.summaries.every((row) => row.netCents === 0)).toBe(true);
    expect(result.allSettled).toBe(true);
    expect(result.transfers).toEqual([]);
  });

  test("AC7 transfer count bounded by non-zero nets minus one", () => {
    const participants = people(["A", "B", "C", "D"]);
    const expenses = [
      expense(1, 40000, [
        { participantId: 1, amountCents: 10000 },
        { participantId: 2, amountCents: 10000 },
        { participantId: 3, amountCents: 10000 },
        { participantId: 4, amountCents: 10000 },
      ]),
      expense(2, 20000, [
        { participantId: 2, amountCents: 6668 },
        { participantId: 3, amountCents: 6666 },
        { participantId: 4, amountCents: 6666 },
      ]),
    ];
    const result = computeSettlement(participants, expenses);
    const nonZero = result.summaries.filter((row) => row.netCents !== 0).length;
    expect(result.transfers.length).toBeLessThanOrEqual(nonZero - 1);
    expect(result.transfers.length).toBe(nonZero - 1);
  });

  test("AC8 no expenses yields empty transfers", () => {
    const participants = people(["A"]);
    const result = computeSettlement(participants, []);
    expect(result.transfers).toEqual([]);
    expect(result.allSettled).toBe(false);
  });

  test("AC6 deterministic for same input", () => {
    const participants = people(["A", "B", "C"]);
    const expenses = [
      expense(1, 30000, [
        { participantId: 1, amountCents: 10000 },
        { participantId: 2, amountCents: 10000 },
        { participantId: 3, amountCents: 10000 },
      ]),
    ];
    const first = computeSettlement(participants, expenses);
    const second = computeSettlement(participants, expenses);
    expect(second).toEqual(first);
  });
});
