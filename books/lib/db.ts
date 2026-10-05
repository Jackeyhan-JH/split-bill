import { createClient, type Client } from "@libsql/client";
import fs from "fs";
import path from "path";

let client: Client | null = null;
let openedUrl: string | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseUrl(): string {
  const fromEnv = process.env.TURSO_DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const file = path.join(process.cwd(), "data", "books.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return `file:${file}`;
}

async function initSchema(db: Client) {
  await db.batch(
    [
      {
        sql: `CREATE TABLE IF NOT EXISTS book_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (list_id) REFERENCES book_lists(id) ON DELETE CASCADE
    )`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_members_list
      ON members (list_id, id)`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      title_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (list_id) REFERENCES book_lists(id) ON DELETE CASCADE,
      UNIQUE (list_id, title_key)
    )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      score INTEGER NOT NULL CHECK (score IN (1, 2, 3)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE (book_id, member_id)
    )`,
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_books_list
      ON books (list_id, id)`,
      },
    ],
    "write",
  );
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
