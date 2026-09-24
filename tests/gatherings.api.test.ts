import { GET } from "@/app/api/gatherings/[id]/route";
import { POST } from "@/app/api/gatherings/route";
import { describe, expect, test } from "vitest";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/gatherings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function get(id: string) {
  return GET(new Request(`http://localhost/api/gatherings/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("gathering API", () => {
  test("empty, blank, and non-text names are rejected", async () => {
    for (const name of ["", "   ", 12, null]) {
      const response = await post({ name });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "请填写饭局名称" });
    }

    const broken = await POST(
      new Request("http://localhost/api/gatherings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ error: "请填写饭局名称" });
  });

  test("create then fetch returns the trimmed name", async () => {
    const created = await post({ name: "  周五火锅  " });
    expect(created.status).toBe(201);
    const gathering = (await created.json()) as { id: string; name: string };
    expect(gathering.name).toBe("周五火锅");
    expect(gathering.id).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const fetched = await get(gathering.id);
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toEqual({ id: gathering.id, name: "周五火锅" });
  });

  test("an unknown id is not found and does not leak another gathering", async () => {
    const created = await post({ name: "周五火锅" });
    const gathering = (await created.json()) as { id: string; name: string };

    const missing = await get("not-a-real-gathering");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "找不到这个饭局" });

    const again = await get(gathering.id);
    expect(await again.json()).toEqual({ id: gathering.id, name: "周五火锅" });
  });

  test("ids are unique, 128 bits, and not derived from the name", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const response = await post({ name: "周五火锅" });
      expect(response.status).toBe(201);
      const gathering = (await response.json()) as { id: string; name: string };
      expect(gathering.name).toBe("周五火锅");
      ids.push(gathering.id);
    }

    expect(new Set(ids).size).toBe(40);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(Buffer.from(id, "base64url")).toHaveLength(16);
      expect(id).not.toContain("周五");
      expect(Number.isNaN(Number(id))).toBe(true);
    }

    const guessed = await get("A".repeat(22));
    expect(guessed.status).toBe(404);
    expect(await guessed.json()).toEqual({ error: "找不到这个饭局" });
  });

  test("two names stay on two links", async () => {
    const first = (await (await post({ name: "A" })).json()) as { id: string; name: string };
    const second = (await (await post({ name: "B" })).json()) as { id: string; name: string };

    expect(first.id).not.toBe(second.id);
    expect(await (await get(first.id)).json()).toEqual({ id: first.id, name: "A" });
    expect(await (await get(second.id)).json()).toEqual({ id: second.id, name: "B" });
  });
});
