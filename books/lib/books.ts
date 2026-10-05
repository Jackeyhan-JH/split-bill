import { copy } from "./copy";
import { getDb } from "./db";
import { getBookList } from "./book-lists";
import {
  MUST_READ_MAX,
  normalizeTitleKey,
  type BookRow,
  type BookScore,
} from "./book-scores";

export type { BookRow, BookScore } from "./book-scores";
export { normalizeTitleKey } from "./book-scores";

type BooksError =
  | typeof copy.notFoundTitle
  | typeof copy.bookTitleRequired
  | typeof copy.memberRequired
  | typeof copy.invalidScore
  | string;

export type BooksResult<T> = { ok: true; value: T } | { ok: false; error: BooksError };

function normalizeTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const title = raw.trim();
  return title || null;
}

function parseScore(raw: unknown): BookScore | null {
  if (raw === 1 || raw === 2 || raw === 3) return raw;
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (n === 1 || n === 2 || n === 3) return n;
  }
  return null;
}

function readBookRow(row: unknown, myScore: BookScore | null): BookRow | null {
  if (!row || typeof row !== "object") return null;
  if (!("id" in row) || !("title" in row)) return null;
  const id = row.id;
  const title = row.title;
  const numericId = typeof id === "bigint" ? Number(id) : id;
  if (typeof numericId !== "number" || typeof title !== "string") return null;
  return { id: numericId, title, myScore };
}

async function memberInList(listId: string, memberId: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM members WHERE id = ? AND list_id = ?",
    args: [memberId, listId],
  });
  return result.rows.length > 0;
}

async function bookInList(listId: string, bookId: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM books WHERE id = ? AND list_id = ?",
    args: [bookId, listId],
  });
  return result.rows.length > 0;
}

export async function listBooks(listId: string, memberId: number | null): Promise<BookRow[]> {
  const db = await getDb();
  const books = await db.execute({
    sql: "SELECT id, title FROM books WHERE list_id = ? ORDER BY id ASC",
    args: [listId],
  });

  if (memberId === null) {
    return books.rows
      .map((row) => readBookRow(row, null))
      .filter((row): row is BookRow => row !== null);
  }

  const ratings = await db.execute({
    sql: `SELECT book_id, score FROM ratings
      WHERE member_id = ? AND book_id IN (
        SELECT id FROM books WHERE list_id = ?
      )`,
    args: [memberId, listId],
  });

  const scoreByBook = new Map<number, BookScore>();
  for (const row of ratings.rows) {
    if (!row || typeof row !== "object" || !("book_id" in row) || !("score" in row)) continue;
    const bookId = row.book_id;
    const score = row.score;
    const numericBookId = typeof bookId === "bigint" ? Number(bookId) : bookId;
    const numericScore = typeof score === "bigint" ? Number(score) : score;
    if (typeof numericBookId === "number" && (numericScore === 1 || numericScore === 2 || numericScore === 3)) {
      scoreByBook.set(numericBookId, numericScore);
    }
  }

  return books.rows
    .map((row) => {
      const book = readBookRow(row, null);
      if (!book) return null;
      return { ...book, myScore: scoreByBook.get(book.id) ?? null };
    })
    .filter((row): row is BookRow => row !== null);
}

function parseRatingScore(raw: unknown): BookScore | null {
  if (raw === 1 || raw === 2 || raw === 3) return raw;
  if (typeof raw === "bigint") {
    const n = Number(raw);
    if (n === 1 || n === 2 || n === 3) return n;
  }
  if (typeof raw === "number") {
    if (raw === 1 || raw === 2 || raw === 3) return raw;
  }
  return null;
}

function readTitle(row: unknown): string | null {
  if (!row || typeof row !== "object" || !("title" in row)) return null;
  const title = row.title;
  return typeof title === "string" ? title : null;
}

type DbClient = Awaited<ReturnType<typeof getDb>>;

async function listMustReadTitles(db: DbClient, listId: string, memberId: number): Promise<string[]> {
  const result = await db.execute({
    sql: `SELECT b.title FROM ratings r
      INNER JOIN books b ON b.id = r.book_id
      WHERE r.member_id = ? AND r.score = 3 AND b.list_id = ?
      ORDER BY b.id ASC`,
    args: [memberId, listId],
  });
  return result.rows.map(readTitle).filter((title): title is string => title !== null);
}

async function upsertRatingInTx(
  db: DbClient,
  bookId: number,
  memberId: number,
  score: BookScore,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO ratings (book_id, member_id, score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(book_id, member_id) DO UPDATE SET
        score = excluded.score,
        updated_at = excluded.updated_at`,
    args: [bookId, memberId, score, now, now],
  });
}

let ratingCapQueue: Promise<unknown> = Promise.resolve();

function withRatingCapLock<T>(work: () => Promise<T>): Promise<T> {
  const next = ratingCapQueue.then(work, work);
  ratingCapQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function upsertRatingWithCap(
  listId: string,
  bookId: number,
  memberId: number,
  score: BookScore,
): Promise<BooksResult<void>> {
  return withRatingCapLock(async () => {
    const db = await getDb();
    await db.execute("BEGIN IMMEDIATE");
    try {
      const current = await db.execute({
        sql: "SELECT score FROM ratings WHERE book_id = ? AND member_id = ?",
        args: [bookId, memberId],
      });
      const currentScore = current.rows[0] ? parseRatingScore(current.rows[0].score) : null;

      if (score === 3 && currentScore !== 3) {
        const titles = await listMustReadTitles(db, listId, memberId);
        if (titles.length >= MUST_READ_MAX) {
          await db.execute("ROLLBACK");
          return { ok: false, error: copy.mustReadCapExceeded(titles) };
        }
      }

      await upsertRatingInTx(db, bookId, memberId, score);
      await db.execute("COMMIT");
      return { ok: true, value: undefined };
    } catch (error) {
      try {
        await db.execute("ROLLBACK");
      } catch {
        /* ignore rollback failure */
      }
      throw error;
    }
  });
}

export async function addBook(
  listId: string,
  memberId: unknown,
  rawTitle: unknown,
  rawScore?: unknown,
): Promise<BooksResult<BookRow>> {
  if (!(await getBookList(listId))) return { ok: false, error: copy.notFoundTitle };

  const parsedMemberId =
    typeof memberId === "number"
      ? memberId
      : typeof memberId === "string"
        ? Number.parseInt(memberId, 10)
        : NaN;
  if (!Number.isFinite(parsedMemberId) || parsedMemberId <= 0) {
    return { ok: false, error: copy.memberRequired };
  }
  if (!(await memberInList(listId, parsedMemberId))) {
    return { ok: false, error: copy.memberRequired };
  }

  const title = normalizeTitle(rawTitle);
  if (!title) return { ok: false, error: copy.bookTitleRequired };

  let score: BookScore | null = null;
  if (rawScore !== undefined && rawScore !== null && rawScore !== "") {
    score = parseScore(rawScore);
    if (score === null) return { ok: false, error: copy.invalidScore };
  }

  const titleKey = normalizeTitleKey(title);
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: "SELECT id, title FROM books WHERE list_id = ? AND title_key = ?",
    args: [listId, titleKey],
  });
  const existingBook = readBookRow(existing.rows[0], null);

  let bookId: number;
  let displayTitle: string;
  if (existingBook) {
    bookId = existingBook.id;
    displayTitle = existingBook.title;
  } else {
    const insert = await db.execute({
      sql: "INSERT INTO books (list_id, title, title_key, created_at) VALUES (?, ?, ?, ?)",
      args: [listId, title, titleKey, now],
    });
    bookId = Number(insert.lastInsertRowid);
    displayTitle = title;
  }

  if (score !== null) {
    const rated = await upsertRatingWithCap(listId, bookId, parsedMemberId, score);
    if (!rated.ok) return { ok: false, error: rated.error };
  }

  const myScore =
    score ??
    (await (async () => {
      const rated = await db.execute({
        sql: "SELECT score FROM ratings WHERE book_id = ? AND member_id = ?",
        args: [bookId, parsedMemberId],
      });
      const row = rated.rows[0];
      if (!row || typeof row !== "object" || !("score" in row)) return null;
      const s = row.score;
      const n = typeof s === "bigint" ? Number(s) : s;
      return n === 1 || n === 2 || n === 3 ? n : null;
    })());

  return { ok: true, value: { id: bookId, title: displayTitle, myScore } };
}

export async function setBookRating(
  listId: string,
  bookId: number,
  memberId: unknown,
  rawScore: unknown,
): Promise<BooksResult<BookRow>> {
  if (!(await getBookList(listId))) return { ok: false, error: copy.notFoundTitle };

  const parsedMemberId =
    typeof memberId === "number"
      ? memberId
      : typeof memberId === "string"
        ? Number.parseInt(memberId, 10)
        : NaN;
  if (!Number.isFinite(parsedMemberId) || parsedMemberId <= 0) {
    return { ok: false, error: copy.memberRequired };
  }
  if (!(await memberInList(listId, parsedMemberId))) {
    return { ok: false, error: copy.memberRequired };
  }
  if (!(await bookInList(listId, bookId))) return { ok: false, error: copy.notFoundTitle };

  const score = parseScore(rawScore);
  if (score === null) return { ok: false, error: copy.invalidScore };

  const rated = await upsertRatingWithCap(listId, bookId, parsedMemberId, score);
  if (!rated.ok) return { ok: false, error: rated.error };

  const db = await getDb();
  const bookRow = await db.execute({
    sql: "SELECT id, title FROM books WHERE id = ? AND list_id = ?",
    args: [bookId, listId],
  });
  const book = readBookRow(bookRow.rows[0], score);
  if (!book) return { ok: false, error: copy.notFoundTitle };
  return { ok: true, value: book };
}

export async function revokeBookRating(
  listId: string,
  bookId: number,
  memberId: unknown,
): Promise<BooksResult<BookRow>> {
  if (!(await getBookList(listId))) return { ok: false, error: copy.notFoundTitle };

  const parsedMemberId =
    typeof memberId === "number"
      ? memberId
      : typeof memberId === "string"
        ? Number.parseInt(memberId, 10)
        : NaN;
  if (!Number.isFinite(parsedMemberId) || parsedMemberId <= 0) {
    return { ok: false, error: copy.memberRequired };
  }
  if (!(await memberInList(listId, parsedMemberId))) {
    return { ok: false, error: copy.memberRequired };
  }
  if (!(await bookInList(listId, bookId))) return { ok: false, error: copy.notFoundTitle };

  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM ratings WHERE book_id = ? AND member_id = ?",
    args: [bookId, parsedMemberId],
  });

  const bookRow = await db.execute({
    sql: "SELECT id, title FROM books WHERE id = ? AND list_id = ?",
    args: [bookId, listId],
  });
  const book = readBookRow(bookRow.rows[0], null);
  if (!book) return { ok: false, error: copy.notFoundTitle };
  return { ok: true, value: book };
}
