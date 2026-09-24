import { GET as getGathering } from "@/app/api/gatherings/[id]/route";
import { POST as createGathering } from "@/app/api/gatherings/route";
import { GET, POST } from "@/app/api/gatherings/[id]/participants/route";
import {
  DELETE,
  PATCH,
} from "@/app/api/gatherings/[id]/participants/[participantId]/route";
import { seedExpense } from "@/lib/expenses";
import { describe, expect, test } from "vitest";

async function create(name: string) {
  const response = await createGathering(
    new Request("http://localhost/api/gatherings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
  return (await response.json()) as { id: string; name: string };
}

async function addPerson(gatheringId: string, name: string) {
  const response = await POST(
    new Request(`http://localhost/api/gatherings/${gatheringId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    { params: Promise.resolve({ id: gatheringId }) },
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { id: number; name: string };
}

function list(gatheringId: string) {
  return GET(new Request(`http://localhost/api/gatherings/${gatheringId}/participants`), {
    params: Promise.resolve({ id: gatheringId }),
  });
}

function add(gatheringId: string, name: unknown) {
  return POST(
    new Request(`http://localhost/api/gatherings/${gatheringId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    { params: Promise.resolve({ id: gatheringId }) },
  );
}

function rename(gatheringId: string, participantId: number, name: unknown) {
  return PATCH(
    new Request(`http://localhost/api/gatherings/${gatheringId}/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    { params: Promise.resolve({ id: gatheringId, participantId: String(participantId) }) },
  );
}

function remove(gatheringId: string, participantId: number) {
  return DELETE(
    new Request(`http://localhost/api/gatherings/${gatheringId}/participants/${participantId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: gatheringId, participantId: String(participantId) }) },
  );
}

describe("participants API", () => {
  test("AC1–AC4 add people with validation", async () => {
    const gathering = await create("饭局");
    await addPerson(gathering.id, "小明");
    expect((await add(gathering.id, "小明")).status).toBe(400);
    expect(await (await add(gathering.id, "小明")).json()).toEqual({
      error: "这个名字已经有了",
    });
    for (const bad of ["", "   ", null]) {
      const response = await add(gathering.id, bad);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "请填写人名" });
    }

    await addPerson(gathering.id, "小红");
    await addPerson(gathering.id, "小刚");
    const listed = await (await list(gathering.id)).json();
    expect(listed).toEqual({
      participants: [
        { id: expect.any(Number), name: "小明" },
        { id: expect.any(Number), name: "小红" },
        { id: expect.any(Number), name: "小刚" },
      ],
    });
  });

  test("AC5–AC6 rename with validation", async () => {
    const gathering = await create("饭局");
    await addPerson(gathering.id, "小明");
    const xiaoHong = await addPerson(gathering.id, "小红");

    const renamed = await rename(gathering.id, xiaoHong.id, "小虹");
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toEqual({ id: xiaoHong.id, name: "小虹" });

    const fetched = await getGathering(new Request(`http://localhost/api/gatherings/${gathering.id}`), {
      params: Promise.resolve({ id: gathering.id }),
    });
    expect(fetched.status).toBe(200);

    for (const bad of ["", "   "]) {
      const response = await rename(gathering.id, xiaoHong.id, bad);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "请填写人名" });
    }

    const duplicate = await rename(gathering.id, xiaoHong.id, "小明");
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toEqual({ error: "这个名字已经有了" });
  });

  test("AC7 delete when no expenses", async () => {
    const gathering = await create("饭局");
    const gang = await addPerson(gathering.id, "小刚");
    expect((await remove(gathering.id, gang.id)).status).toBe(200);
    expect(await (await list(gathering.id)).json()).toEqual({ participants: [] });
  });

  test("AC8 delete blocked when on an expense", async () => {
    const gathering = await create("饭局");
    const xiaoMing = await addPerson(gathering.id, "小明");
    await addPerson(gathering.id, "小红");
    await seedExpense(gathering.id, {
      payerParticipantId: xiaoMing.id,
      splitterParticipantIds: [xiaoMing.id],
    });

    const blocked = await remove(gathering.id, xiaoMing.id);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({
      error: "这个人已出现在账目中，请先改账再删除",
    });
    const listed = await (await list(gathering.id)).json();
    expect(listed.participants.some((person: { name: string }) => person.name === "小明")).toBe(true);
  });
});
