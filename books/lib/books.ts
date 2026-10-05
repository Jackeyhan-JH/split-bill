import { copy } from "./copy";
import { getDb } from "./db";
import { getBookList } from "./book-lists";
import {
  MUST_READ_MAX,
  normalizeTitleKey,
  type BookRating,
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

function readCreatedAt(row: unknown): string | null {
  if (!row || typeof row !== "object" || !("created_at" in row)) return null;
  const createdAt = row.created_at;
  return typeof createdAt === "string" ? createdAt : null;
}

function readBookBase(row: unknown): Omit<BookRow, "myScore" | "ratings"> | null {
  if (!row || typeof row !== "object") return null;
  if (!("id" in row) || !("title" in row)) return null;
  const id = row.id;
  const title = row.title;
  const numericId = typeof id === "bigint" ? Number(id) : id;
  const createdAt = readCreatedAt(row);
  if (typeof numericId !== "number" || typeof title !== "string" || !createdAt) return null;
  return { id: numericId, title, createdAt };
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

function readRatingRow(row: unknown): BookRating | null {
  if (!row || typeof row !== "object") return null;
  if (!("member_id" in row) || !("score" in row) || !("updated_at" in row)) return null;
  const memberId = row.member_id;
  const score = parseRatingScore(row.score);
  const ratedAt = row.updated_at;
  const numericMemberId = typeof memberId === "bigint" ? Number(memberId) : memberId;
  if (typeof numericMemberId !== "number" || score === null || typeof ratedAt !== "string") {
    return null;
  }
  return { memberId: numericMemberId, score, ratedAt };
}

function readTitle(row: unknown): string | null {
  if (!row || typeof row !== "object" || !("title" in row)) return null;
  const title = row.title;
  return typeof title === "string" ? title : null;
}

type DbClient = Awaited<ReturnType<typeof getDb>>;

async function loadRatingsForList(db: DbClient, listId: string): Promise<Map<number, BookRating[]>> {
  const result = await db.execute({
    sql: `SELECT r.book_id, r.member_id, r.score, r.updated_at
      FROM ratings r
      INNER JOIN books b ON b.id = r.book_id
      WHERE b.list_id = ?`,
    args: [listId],
  });
  const byBook = new Map<number, BookRating[]>();
  for (const row of result.rows) {
    const rating = readRatingRow(row);
    if (!rating || !row || typeof row !== "object" || !("book_id" in row)) continue;
    const bookId = row.book_id;
    const numericBookId = typeof bookId === "bigint" ? Number(bookId) : bookId;
    if (typeof numericBookId !== "number") continue;
    const list = byBook.get(numericBookId) ?? [];
    list.push(rating);
    byBook.set(numericBookId, list);
  }
  return byBook;
}

function attachMyScore(book: Omit<BookRow, "myScore">, memberId: number | null): BookRow {
  const myScore =
    memberId === null
      ? null
      : (book.ratings.find((rating) => rating.memberId === memberId)?.score ?? null);
  return { ...book, myScore };
}

async function readBookRow(
  db: DbClient,
  listId: string,
  bookId: number,
  memberId: number | null,
): Promise<BookRow | null> {
  const bookRow = await db.execute({
    sql: "SELECT id, title, created_at FROM books WHERE id = ? AND list_id = ?",
    args: [bookId, listId],
  });
  const base = readBookBase(bookRow.rows[0]);
  if (!base) return null;

  const ratingsResult = await db.execute({
    sql: `SELECT member_id, score, updated_at FROM ratings WHERE book_id = ?`,
    args: [bookId],
  });
  const ratings = ratingsResult.rows
    .map((row) => readRatingRow({ ...row, book_id: bookId }))
    .filter((row): row is BookRating => row !== null);

  return attachMyScore({ ...base, ratings }, memberId);
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
    sql: "SELECT id, title, created_at FROM books WHERE list_id = ? ORDER BY id ASC",
    args: [listId],
  });
  const ratingsByBook = await loadRatingsForList(db, listId);

  return books.rows
    .map((row) => {
      const base = readBookBase(row);
      if (!base) return null;
      const ratings = ratingsByBook.get(base.id) ?? [];
      return attachMyScore({ ...base, ratings }, memberId);
    })
    .filter((row): row is BookRow => row !== null);
}

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
    sql: "SELECT id, title, created_at FROM books WHERE list_id = ? AND title_key = ?",
    args: [listId, titleKey],
  });
  const existingBook = readBookBase(existing.rows[0]);

  let bookId: number;
  if (existingBook) {
    bookId = existingBook.id;
  } else {
    const insert = await db.execute({
      sql: "INSERT INTO books (list_id, title, title_key, created_at) VALUES (?, ?, ?, ?)",
      args: [listId, title, titleKey, now],
    });
    bookId = Number(insert.lastInsertRowid);
  }

  if (score !== null) {
    const rated = await upsertRatingWithCap(listId, bookId, parsedMemberId, score);
    if (!rated.ok) return { ok: false, error: rated.error };
  }

  const book = await readBookRow(db, listId, bookId, parsedMemberId);
  if (!book) return { ok: false, error: copy.notFoundTitle };
  return { ok: true, value: book };
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
  const book = await readBookRow(db, listId, bookId, parsedMemberId);
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

  const book = await readBookRow(db, listId, bookId, parsedMemberId);
  if (!book) return { ok: false, error: copy.notFoundTitle };
  return { ok: true, value: book };
}

export async function deleteBook(
  listId: string,
  bookId: number,
  memberId: unknown,
): Promise<BooksResult<void>> {
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
    sql: "DELETE FROM books WHERE id = ? AND list_id = ?",
    args: [bookId, listId],
  });
  return { ok: true, value: undefined };
}
