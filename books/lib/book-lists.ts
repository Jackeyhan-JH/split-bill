import { randomBytes } from "crypto";
import { copy } from "./copy";
import { getDb } from "./db";

export type BookList = {
  id: string;
  name: string;
};

export type CreateBookListResult =
  | { ok: true; list: BookList }
  | { ok: false; error: typeof copy.nameRequired };

function readList(row: unknown): BookList | null {
  if (!row || typeof row !== "object") return null;
  if (!("id" in row) || !("name" in row)) return null;
  const id = row.id;
  const name = row.name;
  if (typeof id !== "string" || typeof name !== "string") return null;
  return { id, name };
}

function rowToList(row: Record<string, unknown>): BookList | null {
  return readList({ id: row.id, name: row.name });
}

function isIdConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && String(error.code).includes("CONSTRAINT")) return true;
  if ("message" in error && String(error.message).includes("CONSTRAINT")) return true;
  return false;
}

export async function createBookList(rawName: unknown): Promise<CreateBookListResult> {
  if (typeof rawName !== "string") return { ok: false, error: copy.nameRequired };
  const name = rawName.trim();
  if (!name) return { ok: false, error: copy.nameRequired };

  const db = await getDb();
  const createdAt = new Date().toISOString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = randomBytes(16).toString("base64url");
    try {
      await db.execute({
        sql: "INSERT INTO book_lists (id, name, created_at) VALUES (?, ?, ?)",
        args: [id, name, createdAt],
      });
      return { ok: true, list: { id, name } };
    } catch (error) {
      if (!isIdConflict(error) || attempt === 2) throw error;
    }
  }

  throw new Error("could not allocate a book list id");
}

export async function getBookList(id: string): Promise<BookList | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id, name FROM book_lists WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return rowToList(row as Record<string, unknown>);
}
