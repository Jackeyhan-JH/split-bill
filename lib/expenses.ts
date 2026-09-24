import { parseAmountCents } from "./amount";
import { copy } from "./copy";
import { getDb } from "./db";
import { getGathering } from "./gatherings";
import { listParticipants } from "./participants";
import { computeShareCents } from "./split";

export function participantHasExpenseRole(participantId: number): boolean {
  const asPayer = getDb()
    .prepare("SELECT 1 FROM expenses WHERE payer_participant_id = ? LIMIT 1")
    .get(participantId);
  if (asPayer !== undefined) return true;
  const asSplitter = getDb()
    .prepare("SELECT 1 FROM expense_splits WHERE participant_id = ? LIMIT 1")
    .get(participantId);
  return asSplitter !== undefined;
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

function participantMap(gatheringId: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const person of listParticipants(gatheringId)) {
    map.set(person.id, person.name);
  }
  return map;
}

function shareeIdsInJoinOrder(gatheringId: string, selectedIds: number[]): number[] | null {
  const joined = listParticipants(gatheringId).map((person) => person.id);
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

function readShareeIds(expenseId: number): number[] {
  const rows = getDb()
    .prepare(
      `SELECT es.participant_id AS id
       FROM expense_splits es
       INNER JOIN participants p ON p.id = es.participant_id
       WHERE es.expense_id = ?
       ORDER BY p.id ASC`,
    )
    .all(expenseId) as { id: number }[];
  return rows.map((row) => row.id);
}

export function listExpenses(gatheringId: string): ExpenseView[] {
  if (!getGathering(gatheringId)) return [];
  const names = participantMap(gatheringId);
  const rows = getDb()
    .prepare(
      "SELECT id, description, amount_cents, payer_participant_id FROM expenses WHERE gathering_id = ? ORDER BY id ASC",
    )
    .all(gatheringId) as {
    id: number;
    description: string;
    amount_cents: number;
    payer_participant_id: number;
  }[];
  const views: ExpenseView[] = [];
  for (const row of rows) {
    const shareeIds = readShareeIds(row.id);
    const view = buildExpenseView(row, names, shareeIds);
    if (view) views.push(view);
  }
  return views;
}

function validateExpenseInput(
  gatheringId: string,
  body: unknown,
): ExpenseResult<{
  description: string;
  amountCents: number;
  payerParticipantId: number;
  shareeIds: number[];
}> {
  if (!getGathering(gatheringId)) return { ok: false, error: copy.notFoundTitle };
  if (!body || typeof body !== "object") {
    return { ok: false, error: copy.descriptionRequired };
  }
  const description = normalizeDescription("description" in body ? body.description : null);
  if (!description) return { ok: false, error: copy.descriptionRequired };

  const amountField = "amount" in body ? body.amount : "amountCents" in body ? (body as { amountCents: number }).amountCents / 100 : null;
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

  const names = participantMap(gatheringId);
  if (!names.has(payerParticipantId)) return { ok: false, error: copy.payerRequired };
  const ordered = shareeIdsInJoinOrder(gatheringId, shareeIds);
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

export function createExpense(gatheringId: string, body: unknown): ExpenseResult<ExpenseView> {
  const validated = validateExpenseInput(gatheringId, body);
  if (!validated.ok) return validated;
  const { description, amountCents, payerParticipantId, shareeIds } = validated.value;
  const createdAt = new Date().toISOString();
  const db = getDb();
  const expenseId = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO expenses (gathering_id, description, amount_cents, payer_participant_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(gatheringId, description, amountCents, payerParticipantId, createdAt);
    const id = Number(result.lastInsertRowid);
    const insertSplit = db.prepare(
      "INSERT INTO expense_splits (expense_id, participant_id) VALUES (?, ?)",
    );
    for (const participantId of shareeIds) {
      insertSplit.run(id, participantId);
    }
    return id;
  })();

  const names = participantMap(gatheringId);
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

export function updateExpense(
  gatheringId: string,
  expenseId: number,
  body: unknown,
): ExpenseResult<ExpenseView> {
  if (!getGathering(gatheringId)) return { ok: false, error: copy.notFoundTitle };
  const existing = getDb()
    .prepare("SELECT id FROM expenses WHERE id = ? AND gathering_id = ?")
    .get(expenseId, gatheringId);
  if (!existing) return { ok: false, error: copy.notFoundTitle };

  const validated = validateExpenseInput(gatheringId, body);
  if (!validated.ok) return validated;
  const { description, amountCents, payerParticipantId, shareeIds } = validated.value;

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      "UPDATE expenses SET description = ?, amount_cents = ?, payer_participant_id = ? WHERE id = ? AND gathering_id = ?",
    ).run(description, amountCents, payerParticipantId, expenseId, gatheringId);
    db.prepare("DELETE FROM expense_splits WHERE expense_id = ?").run(expenseId);
    const insertSplit = db.prepare(
      "INSERT INTO expense_splits (expense_id, participant_id) VALUES (?, ?)",
    );
    for (const participantId of shareeIds) {
      insertSplit.run(expenseId, participantId);
    }
  })();

  const names = participantMap(gatheringId);
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

export function deleteExpense(gatheringId: string, expenseId: number): ExpenseResult<{ id: number }> {
  if (!getGathering(gatheringId)) return { ok: false, error: copy.notFoundTitle };
  const existing = getDb()
    .prepare("SELECT id FROM expenses WHERE id = ? AND gathering_id = ?")
    .get(expenseId, gatheringId);
  if (!existing) return { ok: false, error: copy.notFoundTitle };
  getDb().prepare("DELETE FROM expenses WHERE id = ? AND gathering_id = ?").run(expenseId, gatheringId);
  return { ok: true, value: { id: expenseId } };
}

export type SeedExpenseInput = {
  payerParticipantId: number;
  splitterParticipantIds: number[];
  description?: string;
  amountCents?: number;
};

export function seedExpense(gatheringId: string, input: SeedExpenseInput): number | null {
  if (!getGathering(gatheringId)) return null;
  const { payerParticipantId, splitterParticipantIds } = input;
  if (!splitterParticipantIds.length) return null;

  const db = getDb();
  const verify = db.prepare(
    "SELECT 1 FROM participants WHERE gathering_id = ? AND id = ? LIMIT 1",
  );
  if (!verify.get(gatheringId, payerParticipantId)) return null;
  for (const id of splitterParticipantIds) {
    if (!verify.get(gatheringId, id)) return null;
  }

  const ordered = shareeIdsInJoinOrder(gatheringId, splitterParticipantIds);
  if (!ordered) return null;

  const description = input.description?.trim() || "测试";
  const amountCents = input.amountCents ?? 100;
  const createdAt = new Date().toISOString();
  const insert = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO expenses (gathering_id, description, amount_cents, payer_participant_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(gatheringId, description, amountCents, payerParticipantId, createdAt);
    const expenseId = Number(result.lastInsertRowid);
    const splitInsert = db.prepare(
      "INSERT INTO expense_splits (expense_id, participant_id) VALUES (?, ?)",
    );
    for (const participantId of ordered) {
      splitInsert.run(expenseId, participantId);
    }
    return expenseId;
  });
  return insert();
}
