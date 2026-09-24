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
    )
  `);
  openedPath = file;
  return database;
}
