import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

let database: Database.Database | null = null;
let openedPath: string | null = null;

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "split-bill.sqlite");
}

export function getDb(): Database.Database {
  const file = databasePath();
  if (database && openedPath === file) return database;
  if (database) database.close();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  database = new Database(file);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS gatherings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gathering_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (gathering_id) REFERENCES gatherings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_participants_gathering
      ON participants (gathering_id, id);

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gathering_id TEXT NOT NULL,
      payer_participant_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (gathering_id) REFERENCES gatherings(id) ON DELETE CASCADE,
      FOREIGN KEY (payer_participant_id) REFERENCES participants(id)
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      expense_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      PRIMARY KEY (expense_id, participant_id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );
  `);
  openedPath = file;
  return database;
}
