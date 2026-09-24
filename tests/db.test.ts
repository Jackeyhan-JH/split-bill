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
      expect(url).toContain("split-bill.db");
    } finally {
      if (saved === undefined) delete process.env.TURSO_DATABASE_URL;
      else process.env.TURSO_DATABASE_URL = saved;
    }
  });

  test("creates schema on an empty database", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "split-bill-empty-")), "fresh.db");
    vi.stubEnv("TURSO_DATABASE_URL", `file:${file}`);
    resetDbForTests();

    const db = await getDb();
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    expect(tables.rows.map((row) => row.name)).toEqual([
      "expense_splits",
      "expenses",
      "gatherings",
      "participants",
    ]);
  });
});
