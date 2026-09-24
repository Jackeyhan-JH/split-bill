import { randomBytes } from "crypto";
import { copy } from "./copy";
import { getDb } from "./db";

export type Gathering = {
  id: string;
  name: string;
};

export type CreateGatheringResult =
  | { ok: true; gathering: Gathering }
  | { ok: false; error: typeof copy.nameRequired };

function readGathering(row: unknown): Gathering | null {
  if (!row || typeof row !== "object") return null;
  if (!("id" in row) || !("name" in row)) return null;
  const id = row.id;
  const name = row.name;
  if (typeof id !== "string" || typeof name !== "string") return null;
  return { id, name };
}

function isIdConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code).includes("SQLITE_CONSTRAINT")
  );
}

export function createGathering(rawName: unknown): CreateGatheringResult {
  if (typeof rawName !== "string") return { ok: false, error: copy.nameRequired };
  const name = rawName.trim();
  if (!name) return { ok: false, error: copy.nameRequired };

  const insert = getDb().prepare(
    "INSERT INTO gatherings (id, name, created_at) VALUES (?, ?, ?)",
  );
  const createdAt = new Date().toISOString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = randomBytes(16).toString("base64url");
    try {
      insert.run(id, name, createdAt);
      return { ok: true, gathering: { id, name } };
    } catch (error) {
      if (!isIdConflict(error) || attempt === 2) throw error;
    }
  }

  throw new Error("could not allocate a gathering id");
}

export function getGathering(id: string): Gathering | null {
  const row = getDb().prepare("SELECT id, name FROM gatherings WHERE id = ?").get(id);
  return readGathering(row);
}
