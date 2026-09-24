import { formatHkd } from "./amount";

export type SettlementParticipant = { id: number; name: string };

export type SettlementExpense = {
  amountCents: number;
  payerParticipantId: number;
  shares: { participantId: number; amountCents: number }[];
};

export type PersonSummary = {
  participantId: number;
  name: string;
  paidCents: number;
  owedCents: number;
  netCents: number;
};

export type Transfer = {
  fromParticipantId: number;
  fromName: string;
  toParticipantId: number;
  toName: string;
  amountCents: number;
};

export type SettlementResult = {
  summaries: PersonSummary[];
  transfers: Transfer[];
  allSettled: boolean;
};

export function formatSignedNet(cents: number): string {
  if (cents === 0) return formatHkd(0);
  const sign = cents > 0 ? "+" : "-";
  return `${sign}${formatHkd(Math.abs(cents))}`;
}

export function formatTransferLine(fromName: string, amountCents: number, toName: string): string {
  return `${fromName} 转 ${formatHkd(amountCents)} 给 ${toName}`;
}

export function computeSettlement(
  participants: SettlementParticipant[],
  expenses: SettlementExpense[],
): SettlementResult {
  const order = participants.map((person) => person.id);
  const names = new Map(participants.map((person) => [person.id, person.name]));

  const paid = new Map<number, number>();
  const owed = new Map<number, number>();
  for (const id of order) {
    paid.set(id, 0);
    owed.set(id, 0);
  }

  for (const expense of expenses) {
    if (names.has(expense.payerParticipantId)) {
      paid.set(
        expense.payerParticipantId,
        (paid.get(expense.payerParticipantId) ?? 0) + expense.amountCents,
      );
    }
    for (const share of expense.shares) {
      if (names.has(share.participantId)) {
        owed.set(share.participantId, (owed.get(share.participantId) ?? 0) + share.amountCents);
      }
    }
  }

  const summaries: PersonSummary[] = participants.map((person) => {
    const paidCents = paid.get(person.id) ?? 0;
    const owedCents = owed.get(person.id) ?? 0;
    return {
      participantId: person.id,
      name: person.name,
      paidCents,
      owedCents,
      netCents: paidCents - owedCents,
    };
  });

  if (expenses.length === 0) {
    return { summaries, transfers: [], allSettled: false };
  }

  const balances = new Map<number, number>();
  for (const row of summaries) {
    balances.set(row.participantId, row.netCents);
  }

  const transfers: Transfer[] = [];
  for (;;) {
    const debtorId = pickDebtor(balances, order);
    const creditorId = pickCreditor(balances, order);
    if (debtorId === null || creditorId === null) break;

    const debt = balances.get(debtorId) ?? 0;
    const credit = balances.get(creditorId) ?? 0;
    const amount = Math.min(-debt, credit);
    if (amount <= 0) break;

    transfers.push({
      fromParticipantId: debtorId,
      fromName: names.get(debtorId) ?? "",
      toParticipantId: creditorId,
      toName: names.get(creditorId) ?? "",
      amountCents: amount,
    });

    balances.set(debtorId, debt + amount);
    balances.set(creditorId, credit - amount);
  }

  const allSettled = summaries.every((row) => row.netCents === 0);
  return { summaries, transfers, allSettled };
}

function pickDebtor(balances: Map<number, number>, order: number[]): number | null {
  let pick: number | null = null;
  let pickBalance = 0;
  for (const id of order) {
    const balance = balances.get(id) ?? 0;
    if (balance >= 0) continue;
    if (pick === null || balance < pickBalance) {
      pick = id;
      pickBalance = balance;
    }
  }
  return pick;
}

function pickCreditor(balances: Map<number, number>, order: number[]): number | null {
  let pick: number | null = null;
  let pickBalance = 0;
  for (const id of order) {
    const balance = balances.get(id) ?? 0;
    if (balance <= 0) continue;
    if (pick === null || balance > pickBalance) {
      pick = id;
      pickBalance = balance;
    }
  }
  return pick;
}
