import { parseAmountCents } from "./amount";
import { copy } from "./copy";
import { getDb } from "./db";
import { getGathering } from "./gatherings";
import { listParticipants } from "./participants";
import { computeShareCents } from "./split";

export async function participantHasExpenseRole(participantId: number): Promise<boolean> {
  const db = await getDb();
  const asPayer = await db.execute({
    sql: "SELECT 1 FROM expenses WHERE payer_participant_id = ? LIMIT 1",
    args: [participantId],
  });
  if (asPayer.rows.length > 0) return true;
  const asSplitter = await db.execute({
    sql: "SELECT 1 FROM expense_splits WHERE participant_id = ? LIMIT 1",
    args: [participantId],
  });
  return asSplitter.rows.length > 0;
}

export type ExpenseShareView = {
  participantId: number;
  name: string;
  amountCents: number;
};

export type ExpenseView = {
  id: number;
  description: string;
  amountCents: number;
  payerParticipantId: number;
  payerName: string;
  shareeParticipantIds: number[];
  shares: ExpenseShareView[];
};

type ExpenseError =
  | typeof copy.notFoundTitle
  | typeof copy.descriptionRequired
  | typeof copy.amountInvalid
  | typeof copy.payerRequired
  | typeof copy.shareesRequired;

export type ExpenseResult<T> = { ok: true; value: T } | { ok: false; error: ExpenseError };

function normalizeDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const description = raw.trim();
  return description || null;
}

function normalizeShareeIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids: number[] = [];
  for (const entry of raw) {
    const id = Number(entry);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function participantMap(gatheringId: string): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (const person of await listParticipants(gatheringId)) {
    map.set(person.id, person.name);
  }
  return map;
}

async function shareeIdsInJoinOrder(gatheringId: string, selectedIds: number[]): Promise<number[] | null> {
  const joined = (await listParticipants(gatheringId)).map((person) => person.id);
  const selected = new Set(selectedIds);
  const ordered = joined.filter((id) => selected.has(id));
  if (ordered.length !== selectedIds.length) return null;
  return ordered;
}

function buildExpenseView(
  row: { id: number; description: string; amount_cents: number; payer_participant_id: number },
  names: Map<number, string>,
  shareeIds: number[],
): ExpenseView | null {
  const payerName = names.get(row.payer_participant_id);
  if (!payerName) return null;
  const shareMap = computeShareCents(row.amount_cents, shareeIds, row.payer_participant_id);
  const shares: ExpenseShareView[] = shareeIds.map((participantId) => ({
    participantId,
    name: names.get(participantId) ?? "",
    amountCents: shareMap.get(participantId) ?? 0,
  }));
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    payerParticipantId: row.payer_participant_id,
    payerName,
    shareeParticipantIds: shareeIds,
    shares,
  };
}

async function readShareeIds(expenseId: number): Promise<number[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT es.participant_id AS id
       FROM expense_splits es
       INNER JOIN participants p ON p.id = es.participant_id
       WHERE es.expense_id = ?
       ORDER BY p.id ASC`,
    args: [expenseId],
  });
  return result.rows.map((row) => Number(row.id));
}

function readExpenseRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    description: String(row.description),
    amount_cents: Number(row.amount_cents),
    payer_participant_id: Number(row.payer_participant_id),
  };
}

export async function listExpenses(gatheringId: string): Promise<ExpenseView[]> {
  if (!(await getGathering(gatheringId))) return [];
  const names = await participantMap(gatheringId);
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id, description, amount_cents, payer_participant_id FROM expenses WHERE gathering_id = ? ORDER BY id ASC",
    args: [gatheringId],
  });
  const views: ExpenseView[] = [];
  for (const raw of result.rows) {
    const row = readExpenseRow(raw as Record<string, unknown>);
    const shareeIds = await readShareeIds(row.id);
    const view = buildExpenseView(row, names, shareeIds);
    if (view) views.push(view);
  }
  return views;
}

async function validateExpenseInput(
  gatheringId: string,
  body: unknown,
): Promise<
  ExpenseResult<{
    description: string;
    amountCents: number;
    payerParticipantId: number;
    shareeIds: number[];
  }>
> {
  if (!(await getGathering(gatheringId))) return { ok: false, error: copy.notFoundTitle };
  if (!body || typeof body !== "object") {
    return { ok: false, error: copy.descriptionRequired };
  }
  const description = normalizeDescription("description" in body ? body.description : null);
  if (!description) return { ok: false, error: copy.descriptionRequired };

  const amountField =
    "amount" in body ? body.amount : "amountCents" in body ? (body as { amountCents: number }).amountCents / 100 : null;
  const amountParsed = parseAmountCents(amountField);
  if (!amountParsed.ok) return { ok: false, error: amountParsed.error };

  const payerRaw = "payerParticipantId" in body ? body.payerParticipantId : null;
  const payerParticipantId = Number(payerRaw);
  if (!Number.isInteger(payerParticipantId) || payerParticipantId <= 0) {
    return { ok: false, error: copy.payerRequired };
  }

  const shareeRaw = "shareeParticipantIds" in body ? body.shareeParticipantIds : null;
  const shareeIds = normalizeShareeIds(shareeRaw);
  if (!shareeIds || shareeIds.length === 0) return { ok: false, error: copy.shareesRequired };

  const names = await participantMap(gatheringId);
  if (!names.has(payerParticipantId)) return { ok: false, error: copy.payerRequired };
  const ordered = await shareeIdsInJoinOrder(gatheringId, shareeIds);
  if (!ordered) return { ok: false, error: copy.shareesRequired };

  return {
    ok: true,
    value: {
      description,
      amountCents: amountParsed.cents,
      payerParticipantId,
      shareeIds: ordered,
    },
  };
}

export async function createExpense(gatheringId: string, body: unknown): Promise<ExpenseResult<ExpenseView>> {
  const validated = await validateExpenseInput(gatheringId, body);
  if (!validated.ok) return validated;
  const { description, amountCents, payerParticipantId, shareeIds } = validated.value;
  const createdAt = new Date().toISOString();
  const db = await getDb();
  const insert = await db.execute({
    sql: "INSERT INTO expenses (gathering_id, description, amount_cents, payer_participant_id, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [gatheringId, description, amountCents, payerParticipantId, createdAt],
  });
  const expenseId = Number(insert.lastInsertRowid);
  if (shareeIds.length > 0) {
    await db.batch(
      shareeIds.map((participantId) => ({
        sql: "INSERT INTO expense_splits (expense_id, participant_id) VALUES (?, ?)",
        args: [expenseId, participantId],
      })),
      "write",
    );
  }

  const names = await participantMap(gatheringId);
  const row = {
    id: expenseId,
    description,
    amount_cents: amountCents,
    payer_participant_id: payerParticipantId,
  };
  const view = buildExpenseView(row, names, shareeIds);
  if (!view) return { ok: false, error: copy.notFoundTitle };
  return { ok: true, value: view };
}

export async function updateExpense(
  gatheringId: string,
  expenseId: number,
  body: unknown,
): Promise<ExpenseResult<ExpenseView>> {
  if (!(await getGathering(gatheringId))) return { ok: false, error: copy.notFoundTitle };
  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id FROM expenses WHERE id = ? AND gathering_id = ?",
    args: [expenseId, gatheringId],
  });
  if (existing.rows.length === 0) return { ok: false, error: copy.notFoundTitle };

  const validated = await validateExpenseInput(gatheringId, body);
  if (!validated.ok) return validated;
  const { description, amountCents, payerParticipantId, shareeIds } = validated.value;

  await db.batch(
    [
      {
        sql: "UPDATE expenses SET description = ?, amount_cents = ?, payer_participant_id = ? WHERE id = ? AND gathering_id = ?",
        args: [description, amountCents, payerParticipantId, expenseId, gatheringId],
      },
      {
        sql: "DELETE FROM expense_splits WHERE expense_id = ?",
        args: [expenseId],
      },
      ...shareeIds.map((participantId) => ({
        sql: "INSERT INTO expense_splits (expense_id, participant_id) VALUES (?, ?)",
        args: [expenseId, participantId],
      })),
    ],
    "write",
  );

  const names = await participantMap(gatheringId);
  const row = {
    id: expenseId,
    description,
    amount_cents: amountCents,
    payer_participant_id: payerParticipantId,
  };
  const view = buildExpenseView(row, names, shareeIds);
  if (!view) return { ok: false, error: copy.notFoundTitle };
  return { ok: true, value: view };
}

export async function deleteExpense(
  gatheringId: string,
  expenseId: number,
): Promise<ExpenseResult<{ id: number }>> {
  if (!(await getGathering(gatheringId))) return { ok: false, error: copy.notFoundTitle };
  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id FROM expenses WHERE id = ? AND gathering_id = ?",
    args: [expenseId, gatheringId],
  });
  if (existing.rows.length === 0) return { ok: false, error: copy.notFoundTitle };
  await db.execute({
    sql: "DELETE FROM expenses WHERE id = ? AND gathering_id = ?",
    args: [expenseId, gatheringId],
  });
  return { ok: true, value: { id: expenseId } };
}

export type SeedExpenseInput = {
  payerParticipantId: number;
  splitterParticipantIds: number[];
  description?: string;
  amountCents?: number;
};

export async function seedExpense(gatheringId: string, input: SeedExpenseInput): Promise<number | null> {
  if (!(await getGathering(gatheringId))) return null;
  const { payerParticipantId, splitterParticipantIds } = input;
  if (!splitterParticipantIds.length) return null;

  const db = await getDb();
  const verify = async (participantId: number) => {
    const result = await db.execute({
      sql: "SELECT 1 FROM participants WHERE gathering_id = ? AND id = ? LIMIT 1",
      args: [gatheringId, participantId],
    });
    return result.rows.length > 0;
  };
  if (!(await verify(payerParticipantId))) return null;
  for (const id of splitterParticipantIds) {
    if (!(await verify(id))) return null;
  }

  const ordered = await shareeIdsInJoinOrder(gatheringId, splitterParticipantIds);
  if (!ordered) return null;

  const description = input.description?.trim() || "测试";
  const amountCents = input.amountCents ?? 100;
  const createdAt = new Date().toISOString();
  const insert = await db.execute({
    sql: "INSERT INTO expenses (gathering_id, description, amount_cents, payer_participant_id, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [gatheringId, description, amountCents, payerParticipantId, createdAt],
  });
  const expenseId = Number(insert.lastInsertRowid);
  await db.batch(
    ordered.map((participantId) => ({
      sql: "INSERT INTO expense_splits (expense_id, participant_id) VALUES (?, ?)",
      args: [expenseId, participantId],
    })),
    "write",
  );
  return expenseId;
}
