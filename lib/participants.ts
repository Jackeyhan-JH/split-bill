import { copy } from "./copy";
import { getDb } from "./db";
import { getGathering } from "./gatherings";
import { participantHasExpenseRole } from "./expenses";

export type Participant = {
  id: number;
  name: string;
};

type ParticipantError =
  | typeof copy.personNameRequired
  | typeof copy.personNameDuplicate
  | typeof copy.notFoundTitle
  | typeof copy.personOnExpense;

export type ParticipantResult<T> = { ok: true; value: T } | { ok: false; error: ParticipantError };

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name || null;
}

function readRow(row: unknown): Participant | null {
  if (!row || typeof row !== "object") return null;
  if (!("id" in row) || !("name" in row)) return null;
  const id = row.id;
  const name = row.name;
  const numericId = typeof id === "bigint" ? Number(id) : id;
  if (typeof numericId !== "number" || typeof name !== "string") return null;
  return { id: numericId, name };
}

export async function listParticipants(gatheringId: string): Promise<Participant[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id, name FROM participants WHERE gathering_id = ? ORDER BY id ASC",
    args: [gatheringId],
  });
  return result.rows.map((row) => readRow(row)).filter((row): row is Participant => row !== null);
}

async function nameTaken(gatheringId: string, name: string, exceptId?: number): Promise<boolean> {
  const db = await getDb();
  const result = exceptId
    ? await db.execute({
        sql: "SELECT 1 FROM participants WHERE gathering_id = ? AND name = ? AND id != ? LIMIT 1",
        args: [gatheringId, name, exceptId],
      })
    : await db.execute({
        sql: "SELECT 1 FROM participants WHERE gathering_id = ? AND name = ? LIMIT 1",
        args: [gatheringId, name],
      });
  return result.rows.length > 0;
}

export async function addParticipant(
  gatheringId: string,
  rawName: unknown,
): Promise<ParticipantResult<Participant>> {
  if (!(await getGathering(gatheringId))) return { ok: false, error: copy.notFoundTitle };
  const name = normalizeName(rawName);
  if (!name) return { ok: false, error: copy.personNameRequired };
  if (await nameTaken(gatheringId, name)) return { ok: false, error: copy.personNameDuplicate };

  const db = await getDb();
  const createdAt = new Date().toISOString();
  const insert = await db.execute({
    sql: "INSERT INTO participants (gathering_id, name, created_at) VALUES (?, ?, ?)",
    args: [gatheringId, name, createdAt],
  });
  const id = Number(insert.lastInsertRowid);
  return { ok: true, value: { id, name } };
}

export async function renameParticipant(
  gatheringId: string,
  participantId: number,
  rawName: unknown,
): Promise<ParticipantResult<Participant>> {
  if (!(await getGathering(gatheringId))) return { ok: false, error: copy.notFoundTitle };
  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id, name FROM participants WHERE id = ? AND gathering_id = ?",
    args: [participantId, gatheringId],
  });
  if (!readRow(existing.rows[0])) return { ok: false, error: copy.notFoundTitle };

  const name = normalizeName(rawName);
  if (!name) return { ok: false, error: copy.personNameRequired };
  if (await nameTaken(gatheringId, name, participantId)) {
    return { ok: false, error: copy.personNameDuplicate };
  }

  await db.execute({
    sql: "UPDATE participants SET name = ? WHERE id = ? AND gathering_id = ?",
    args: [name, participantId, gatheringId],
  });
  return { ok: true, value: { id: participantId, name } };
}

export async function removeParticipant(
  gatheringId: string,
  participantId: number,
): Promise<ParticipantResult<{ id: number }>> {
  if (!(await getGathering(gatheringId))) return { ok: false, error: copy.notFoundTitle };
  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id FROM participants WHERE id = ? AND gathering_id = ?",
    args: [participantId, gatheringId],
  });
  if (existing.rows.length === 0) return { ok: false, error: copy.notFoundTitle };
  if (await participantHasExpenseRole(participantId)) {
    return { ok: false, error: copy.personOnExpense };
  }

  await db.execute({
    sql: "DELETE FROM participants WHERE id = ? AND gathering_id = ?",
    args: [participantId, gatheringId],
  });
  return { ok: true, value: { id: participantId } };
}

export async function gatheringHasExpenses(gatheringId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM expenses WHERE gathering_id = ? LIMIT 1",
    args: [gatheringId],
  });
  return result.rows.length > 0;
}
