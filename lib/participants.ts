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
  if (typeof id !== "number" || typeof name !== "string") return null;
  return { id, name };
}

export function listParticipants(gatheringId: string): Participant[] {
  const rows = getDb()
    .prepare("SELECT id, name FROM participants WHERE gathering_id = ? ORDER BY id ASC")
    .all(gatheringId);
  return rows.map((row) => readRow(row)).filter((row): row is Participant => row !== null);
}

function nameTaken(gatheringId: string, name: string, exceptId?: number): boolean {
  const row = exceptId
    ? getDb()
        .prepare(
          "SELECT 1 FROM participants WHERE gathering_id = ? AND name = ? AND id != ? LIMIT 1",
        )
        .get(gatheringId, name, exceptId)
    : getDb()
        .prepare("SELECT 1 FROM participants WHERE gathering_id = ? AND name = ? LIMIT 1")
        .get(gatheringId, name);
  return row !== undefined;
}

export function addParticipant(gatheringId: string, rawName: unknown): ParticipantResult<Participant> {
  if (!getGathering(gatheringId)) return { ok: false, error: copy.notFoundTitle };
  const name = normalizeName(rawName);
  if (!name) return { ok: false, error: copy.personNameRequired };
  if (nameTaken(gatheringId, name)) return { ok: false, error: copy.personNameDuplicate };

  const createdAt = new Date().toISOString();
  const result = getDb()
    .prepare("INSERT INTO participants (gathering_id, name, created_at) VALUES (?, ?, ?)")
    .run(gatheringId, name, createdAt);
  const id = Number(result.lastInsertRowid);
  return { ok: true, value: { id, name } };
}

export function renameParticipant(
  gatheringId: string,
  participantId: number,
  rawName: unknown,
): ParticipantResult<Participant> {
  if (!getGathering(gatheringId)) return { ok: false, error: copy.notFoundTitle };
  const existing = getDb()
    .prepare("SELECT id, name FROM participants WHERE id = ? AND gathering_id = ?")
    .get(participantId, gatheringId);
  if (!readRow(existing)) return { ok: false, error: copy.notFoundTitle };

  const name = normalizeName(rawName);
  if (!name) return { ok: false, error: copy.personNameRequired };
  if (nameTaken(gatheringId, name, participantId)) return { ok: false, error: copy.personNameDuplicate };

  getDb()
    .prepare("UPDATE participants SET name = ? WHERE id = ? AND gathering_id = ?")
    .run(name, participantId, gatheringId);
  return { ok: true, value: { id: participantId, name } };
}

export function removeParticipant(
  gatheringId: string,
  participantId: number,
): ParticipantResult<{ id: number }> {
  if (!getGathering(gatheringId)) return { ok: false, error: copy.notFoundTitle };
  const existing = getDb()
    .prepare("SELECT id FROM participants WHERE id = ? AND gathering_id = ?")
    .get(participantId, gatheringId);
  if (!existing) return { ok: false, error: copy.notFoundTitle };
  if (participantHasExpenseRole(participantId)) {
    return { ok: false, error: copy.personOnExpense };
  }

  getDb().prepare("DELETE FROM participants WHERE id = ? AND gathering_id = ?").run(participantId, gatheringId);
  return { ok: true, value: { id: participantId } };
}

export function gatheringHasExpenses(gatheringId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM expenses WHERE gathering_id = ? LIMIT 1")
    .get(gatheringId);
  return row !== undefined;
}
