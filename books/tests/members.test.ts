import { POST as createList } from "../app/api/book-lists/route";
import { GET, POST } from "../app/api/book-lists/[id]/members/route";
import { PATCH } from "../app/api/book-lists/[id]/members/[memberId]/route";
import { describe, expect, test } from "vitest";

async function seedList(name = "周末读书会") {
  const response = await createList(
    new Request("http://localhost/api/book-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
  return (await response.json()) as { id: string };
}

function listMembers(listId: string) {
  return GET(new Request(`http://localhost/api/book-lists/${listId}/members`), {
    params: Promise.resolve({ id: listId }),
  });
}

function addMember(listId: string, name: string) {
  return POST(
    new Request(`http://localhost/api/book-lists/${listId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    { params: Promise.resolve({ id: listId }) },
  );
}

function renameMember(listId: string, memberId: number, name: string) {
  return PATCH(
    new Request(`http://localhost/api/book-lists/${listId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    { params: Promise.resolve({ id: listId, memberId: String(memberId) }) },
  );
}

describe("members API", () => {
  test("add and list members; duplicate names allowed", async () => {
    const { id } = await seedList();
    for (const name of ["阿明", "小红", "Jackey"]) {
      const response = await addMember(id, name);
      expect(response.status).toBe(201);
    }
    const dup = await addMember(id, "阿明");
    expect(dup.status).toBe(201);

    const listed = await listMembers(id);
    const body = (await listed.json()) as { members: { name: string }[] };
    expect(body.members.map((member) => member.name)).toEqual([
      "阿明",
      "小红",
      "Jackey",
      "阿明",
    ]);
  });

  test("rename member", async () => {
    const { id } = await seedList();
    const created = await addMember(id, "阿明");
    const member = (await created.json()) as { member: { id: number } };

    const updated = await renameMember(id, member.member.id, "阿明哥");
    expect(updated.status).toBe(200);
    const listed = await listMembers(id);
    const body = (await listed.json()) as { members: { name: string }[] };
    expect(body.members[0]?.name).toBe("阿明哥");
  });

  test("members on missing list return 404", async () => {
    const response = await addMember("missing-list-id", "阿明");
    expect(response.status).toBe(404);
  });
});
