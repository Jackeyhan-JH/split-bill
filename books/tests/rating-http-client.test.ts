import {
  type Client,
  type InStatement,
  type ResultSet,
  type TransactionMode,
} from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as dbModule from "@/lib/db";
import { addBook, setBookRating } from "@/lib/books";
import { copy } from "@/lib/copy";
import { POST as createList } from "../app/api/book-lists/route";
import { POST as addMember } from "../app/api/book-lists/[id]/members/route";

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

/**
 * Simulates libsql over HTTP: each standalone Client.execute runs on its own connection,
 * so manual BEGIN/COMMIT do not wrap later executes. Interactive db.transaction() still works.
 */
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
      body: JSON.stringify({ name: "远程事务验收" }),
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

describe("ratings with HTTP-like libsql client", () => {
  let getDbSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(async () => {
    dbModule.resetDbForTests();
    vi.unstubAllEnvs();
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "books-http-")), "remote-like.db");
    vi.stubEnv("TURSO_DATABASE_URL", `file:${file}`);
    const real = await dbModule.getDb();
    const split = splitExecuteClient(real);
    getDbSpy = vi.spyOn(dbModule, "getDb").mockResolvedValue(split);
  });

  afterEach(() => {
    getDbSpy?.mockRestore();
    dbModule.resetDbForTests();
    vi.unstubAllEnvs();
  });

  test("legacy BEGIN/COMMIT via separate execute calls fails on split client", async () => {
    const db = await dbModule.getDb();
    await db.execute("BEGIN IMMEDIATE");
    await expect(db.execute("COMMIT")).rejects.toThrow(/commit/i);
  });

  test("setBookRating succeeds without COMMIT error", async () => {
    const { listId, memberId } = await seedListAndMember();
    const added = await addBook(listId, memberId, "三体", 2);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const bookId = added.value.id;

    const rated = await setBookRating(listId, bookId, memberId, 3);
    expect(rated.ok).toBe(true);
    if (!rated.ok) return;
    expect(rated.value.myScore).toBe(3);
  });

  test("must-read cap returns structured error instead of throwing", async () => {
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
    expect(result.error).toContain("最多 5 本必读");
    expect(result.error).toBe(copy.mustReadCapExceeded([...titles]));
  });

  test("addBook with score 3 blocked at cap returns error JSON path", async () => {
    const { listId, memberId } = await seedListAndMember();
    const titles = ["三体", "活着", "百年孤独", "人类简史", "红楼梦"] as const;
    for (const title of titles) {
      await addBook(listId, memberId, title, 3);
    }

    const blocked = await addBook(listId, memberId, "围城", 3);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toContain("最多 5 本必读");
  });
});
