import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { databaseUrl, getDb, resetDbForTests } from "@/lib/db";

describe("database layer", () => {
  afterEach(() => {
    resetDbForTests();
    vi.unstubAllEnvs();
  });

  test("uses local file when Turso env is unset", () => {
    const saved = process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_DATABASE_URL;
    try {
      const url = databaseUrl();
      expect(url).toMatch(/^file:/);
      expect(url).toContain("books.db");
    } finally {
      if (saved === undefined) delete process.env.TURSO_DATABASE_URL;
      else process.env.TURSO_DATABASE_URL = saved;
    }
  });

  test("uses TURSO_DATABASE_URL when set", () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://books-example.turso.io");
    expect(databaseUrl()).toBe("libsql://books-example.turso.io");
  });

  test("creates schema on an empty database", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "books-empty-")), "fresh.db");
    vi.stubEnv("TURSO_DATABASE_URL", `file:${file}`);
    resetDbForTests();

    const db = await getDb();
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    expect(tables.rows.map((row) => row.name)).toEqual(["book_lists", "books", "members", "ratings"]);
  });

  test("initSchema is idempotent on second getDb", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "books-idem-")), "fresh.db");
    vi.stubEnv("TURSO_DATABASE_URL", `file:${file}`);
    resetDbForTests();

    const db1 = await getDb();
    await db1.execute({
      sql: "INSERT INTO book_lists (id, name, created_at) VALUES (?, ?, ?)",
      args: ["list-1", "验收", "2026-01-01T00:00:00.000Z"],
    });

    resetDbForTests();
    vi.stubEnv("TURSO_DATABASE_URL", `file:${file}`);
    const db2 = await getDb();
    const row = await db2.execute("SELECT name FROM book_lists WHERE id = 'list-1'");
    expect(row.rows[0]?.name).toBe("验收");
  });
});
