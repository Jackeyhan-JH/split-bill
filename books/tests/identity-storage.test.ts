import {
  clearStoredMemberId,
  identityStorageKey,
  readStoredMemberId,
  resolveMemberId,
  writeStoredMemberId,
  type StorageLike,
} from "../lib/identity-storage";
import { describe, expect, test } from "vitest";

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("identity storage", () => {
  test("key is scoped per list id", () => {
    expect(identityStorageKey("abc")).toBe("books:identity:abc");
  });

  test("read/write round trip", () => {
    const storage = memoryStorage();
    writeStoredMemberId(storage, "list-1", 42);
    expect(readStoredMemberId(storage, "list-1")).toBe(42);
    clearStoredMemberId(storage, "list-1");
    expect(readStoredMemberId(storage, "list-1")).toBeNull();
  });

  test("resolve ignores stale member id", () => {
    expect(resolveMemberId([{ id: 1 }, { id: 2 }], 99)).toBeNull();
    expect(resolveMemberId([{ id: 1 }, { id: 2 }], 2)).toBe(2);
  });
});
