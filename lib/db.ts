import { createClient, type Client } from "@libsql/client";
import fs from "fs";
import path from "path";

let client: Client | null = null;
let openedUrl: string | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseUrl(): string {
  const fromEnv = process.env.TURSO_DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const file = path.join(process.cwd(), "data", "split-bill.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return `file:${file}`;
}

async function migrateExpensesColumns(db: Client) {
  const result = await db.execute("PRAGMA table_info(expenses)");
  const names = new Set(result.rows.map((row) => String(row.name)));
  if (!names.has("description")) {
    await db.execute("ALTER TABLE expenses ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("amount_cents")) {
    await db.execute("ALTER TABLE expenses ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 100");
  }
}

async function initSchema(db: Client) {
  await db.batch(
    [
      {
        sql: `CREATE TABLE IF NOT EXISTS gatherings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gathering_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (gathering_id) REFERENCES gatherings(id) ON DELETE CASCADE
    )`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_participants_gathering
      ON participants (gathering_id, id)`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gathering_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payer_participant_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (gathering_id) REFERENCES gatherings(id) ON DELETE CASCADE,
      FOREIGN KEY (payer_participant_id) REFERENCES participants(id)
    )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS expense_splits (
      expense_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      PRIMARY KEY (expense_id, participant_id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    )`,
      },
    ],
    "write",
  );
  await migrateExpensesColumns(db);
}

export async function getDb(): Promise<Client> {
  const url = databaseUrl();
  if (client && openedUrl === url) {
    await schemaReady;
    return client;
  }
  client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  openedUrl = url;
  schemaReady = initSchema(client);
  await schemaReady;
  return client;
}

/** Test-only: reset singleton so the next getDb() opens a fresh client. */
export function resetDbForTests() {
  client = null;
  openedUrl = null;
  schemaReady = null;
}
