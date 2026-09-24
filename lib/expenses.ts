import { getDb } from "./db";
import { getGathering } from "./gatherings";

/** Minimal expense row for delete guards and test seeding (no expense UI in this slice). */
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

export type SeedExpenseInput = {
  payerParticipantId: number;
  splitterParticipantIds: number[];
};

/**
 * Inserts a placeholder expense so participant delete can be tested against real FK data.
 * Used by unit tests and the E2E-only POST /api/gatherings/[id]/test/expenses route.
 */
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

  const createdAt = new Date().toISOString();
  const insert = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO expenses (gathering_id, payer_participant_id, created_at) VALUES (?, ?, ?)",
      )
      .run(gatheringId, payerParticipantId, createdAt);
    const expenseId = Number(result.lastInsertRowid);
    const splitInsert = db.prepare(
      "INSERT INTO expense_splits (expense_id, participant_id) VALUES (?, ?)",
    );
    for (const participantId of splitterParticipantIds) {
      splitInsert.run(expenseId, participantId);
    }
    return expenseId;
  });
  return insert();
}
