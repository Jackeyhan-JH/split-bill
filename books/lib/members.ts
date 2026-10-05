import { copy } from "./copy";
import { getDb } from "./db";
import { getBookList } from "./book-lists";

export type Member = {
  id: number;
  name: string;
};

type MemberError = typeof copy.memberNameRequired | typeof copy.notFoundTitle;

export type MemberResult<T> = { ok: true; value: T } | { ok: false; error: MemberError };

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name || null;
}

function readRow(row: unknown): Member | null {
  if (!row || typeof row !== "object") return null;
  if (!("id" in row) || !("name" in row)) return null;
  const id = row.id;
  const name = row.name;
  const numericId = typeof id === "bigint" ? Number(id) : id;
  if (typeof numericId !== "number" || typeof name !== "string") return null;
  return { id: numericId, name };
}

export async function listMembers(listId: string): Promise<Member[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id, name FROM members WHERE list_id = ? ORDER BY id ASC",
    args: [listId],
  });
  return result.rows.map((row) => readRow(row)).filter((row): row is Member => row !== null);
}

export async function addMember(listId: string, rawName: unknown): Promise<MemberResult<Member>> {
  if (!(await getBookList(listId))) return { ok: false, error: copy.notFoundTitle };
  const name = normalizeName(rawName);
  if (!name) return { ok: false, error: copy.memberNameRequired };

  const db = await getDb();
  const createdAt = new Date().toISOString();
  const insert = await db.execute({
    sql: "INSERT INTO members (list_id, name, created_at) VALUES (?, ?, ?)",
    args: [listId, name, createdAt],
  });
  const id = Number(insert.lastInsertRowid);
  return { ok: true, value: { id, name } };
}

export async function renameMember(
  listId: string,
  memberId: number,
  rawName: unknown,
): Promise<MemberResult<Member>> {
  if (!(await getBookList(listId))) return { ok: false, error: copy.notFoundTitle };
  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id, name FROM members WHERE id = ? AND list_id = ?",
    args: [memberId, listId],
  });
  if (!readRow(existing.rows[0])) return { ok: false, error: copy.notFoundTitle };

  const name = normalizeName(rawName);
  if (!name) return { ok: false, error: copy.memberNameRequired };

  await db.execute({
    sql: "UPDATE members SET name = ? WHERE id = ? AND list_id = ?",
    args: [name, memberId, listId],
  });
  return { ok: true, value: { id: memberId, name } };
}
