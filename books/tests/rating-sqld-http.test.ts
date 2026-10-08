import { type Client, type InStatement, type ResultSet, type TransactionMode } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addBook, setBookRating } from "../lib/books";
import { copy } from "../lib/copy";
import * as dbModule from "../lib/db";
import { POST as createList } from "../app/api/book-lists/route";
import { POST as addMember } from "../app/api/book-lists/[id]/members/route";

const sqldHttpUrl = process.env.BOOKS_LIBSQL_HTTP_URL?.trim();

const emptyResult = {
  columns: [],
  columnTypes: [],
  rows: [],
  rowsAffected: 0,
  lastInsertRowid: undefined,
  toJSON() {
    return { columns: [], columnTypes: [], rows: [] };
  },
} satisfies ResultSet;

/** Same simulation as rating-http-client.test.ts — documents pre-fix Turso failure mode. */
function splitExecuteClient(underlying: Client): Client {
  const split = {
    execute(stmt: InStatement) {
      const sql = (typeof stmt === "string" ? stmt : stmt.sql).trim().toUpperCase();
      if (sql === "BEGIN IMMEDIATE" || sql === "BEGIN") {
        return Promise.resolve(emptyResult);
      }
      if (sql === "COMMIT") {
        return Promise.reject(new Error("SQLITE_ERROR: cannot commit - no transaction is active"));
      }
      if (sql === "ROLLBACK") {
        return Promise.resolve(emptyResult);
      }
      return underlying.execute(stmt);
    },
    batch(stmts: InStatement[], mode?: TransactionMode) {
      return underlying.batch(stmts, mode);
    },
    transaction(mode?: TransactionMode) {
      return mode === undefined ? underlying.transaction() : underlying.transaction(mode);
    },
    migrate(stmts: InStatement[]) {
      return underlying.migrate(stmts);
    },
    executeMultiple(sql: string) {
      return underlying.executeMultiple(sql);
    },
    sync() {
      return underlying.sync();
    },
    close() {
      return underlying.close();
    },
  };
  return split as Client;
}

async function seedListAndMember() {
  const listRes = await createList(
    new Request("http://localhost/api/book-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "sqld HTTP 验收" }),
    }),
  );
  const { id: listId } = (await listRes.json()) as { id: string };
  const memberRes = await addMember(
    new Request(`http://localhost/api/book-lists/${listId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jackey" }),
    }),
    { params: Promise.resolve({ id: listId }) },
  );
  const { member } = (await memberRes.json()) as { member: { id: number } };
  return { listId, memberId: member.id };
}

describe.runIf(Boolean(sqldHttpUrl))("ratings against libsql HTTP (sqld)", () => {
  afterEach(() => {
    dbModule.resetDbForTests();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    dbModule.resetDbForTests();
    vi.unstubAllEnvs();
    vi.stubEnv("TURSO_DATABASE_URL", sqldHttpUrl!);
    await dbModule.getDb();
  });

  test("legacy BEGIN/COMMIT via separate execute calls fails on HTTP", async () => {
    const db = await dbModule.getDb();
    await db.execute("BEGIN IMMEDIATE");
    await expect(db.execute("COMMIT")).rejects.toThrow();
  });

  test("setBookRating succeeds over HTTP", async () => {
    const { listId, memberId } = await seedListAndMember();
    const added = await addBook(listId, memberId, "三体", 2);
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const rated = await setBookRating(listId, added.value.id, memberId, 3);
    expect(rated.ok).toBe(true);
    if (!rated.ok) return;
    expect(rated.value.myScore).toBe(3);
  });

  test("must-read cap returns structured error over HTTP", async () => {
    const { listId, memberId } = await seedListAndMember();
    const titles = ["三体", "活着", "百年孤独", "人类简史", "红楼梦"] as const;
    for (const title of titles) {
      const res = await addBook(listId, memberId, title, 3);
      expect(res.ok).toBe(true);
    }

    const wei = await addBook(listId, memberId, "围城", 1);
    expect(wei.ok).toBe(true);
    if (!wei.ok) return;

    const result = await setBookRating(listId, wei.value.id, memberId, 3);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(copy.mustReadCapExceeded([...titles]));
  });
});

describe.runIf(Boolean(sqldHttpUrl))("legacy rating path regression (split client on file backend)", () => {
  let getDbSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(async () => {
    dbModule.resetDbForTests();
    vi.unstubAllEnvs();
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "books-legacy-")), "legacy.db");
    vi.stubEnv("TURSO_DATABASE_URL", `file:${file}`);
    const real = await dbModule.getDb();
    getDbSpy = vi.spyOn(dbModule, "getDb").mockResolvedValue(splitExecuteClient(real));
  });

  afterEach(() => {
    getDbSpy?.mockRestore();
    dbModule.resetDbForTests();
    vi.unstubAllEnvs();
  });

  test("legacy BEGIN/COMMIT pattern throws before rating logic completes", async () => {
    const db = await dbModule.getDb();
    await db.execute("BEGIN IMMEDIATE");
    await db.execute({
      sql: "SELECT 1",
    });
    await expect(db.execute("COMMIT")).rejects.toThrow(/commit/i);
  });
});
