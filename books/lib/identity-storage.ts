const PREFIX = "books:identity:";

export function identityStorageKey(listId: string): string {
  return `${PREFIX}${listId}`;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readStoredMemberId(storage: StorageLike | null, listId: string): number | null {
  if (!storage) return null;
  const raw = storage.getItem(identityStorageKey(listId));
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export function writeStoredMemberId(storage: StorageLike | null, listId: string, memberId: number): void {
  if (!storage) return;
  storage.setItem(identityStorageKey(listId), String(memberId));
}

export function clearStoredMemberId(storage: StorageLike | null, listId: string): void {
  if (!storage) return;
  storage.removeItem(identityStorageKey(listId));
}

export function resolveMemberId(
  members: { id: number }[],
  storedId: number | null,
): number | null {
  if (storedId === null) return null;
  return members.some((member) => member.id === storedId) ? storedId : null;
}
