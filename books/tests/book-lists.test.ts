import { GET } from "../app/api/book-lists/[id]/route";
import { POST } from "../app/api/book-lists/route";
import { describe, expect, test } from "vitest";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/book-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function get(id: string) {
  return GET(new Request(`http://localhost/api/book-lists/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("book list API", () => {
  test("empty, blank, and non-text names are rejected", async () => {
    for (const name of ["", "   ", 12, null]) {
      const response = await post({ name });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "请填写书单名称" });
    }
  });

  test("create returns an unguessable base64url id", async () => {
    const created = await post({ name: "周末读书会" });
    expect(created.status).toBe(201);
    const list = (await created.json()) as { id: string; name: string };
    expect(list.name).toBe("周末读书会");
    expect(list.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(list.id).not.toMatch(/^\d+$/);
  });

  test("two creates get distinct ids", async () => {
    const a = (await (await post({ name: "A" })).json()) as { id: string };
    const b = (await (await post({ name: "B" })).json()) as { id: string };
    expect(a.id).not.toBe(b.id);
  });

  test("unknown id is not found and does not leak another list", async () => {
    const created = await post({ name: "周末读书会" });
    const list = (await created.json()) as { id: string; name: string };

    const missing = await get("not-a-real-list-id");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "找不到这个书单" });

    const again = await get(list.id);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ id: list.id, name: "周末读书会" });
  });
});
