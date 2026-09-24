import { POST as createGathering } from "@/app/api/gatherings/route";
import { POST as addPerson } from "@/app/api/gatherings/[id]/participants/route";
import { DELETE as deletePerson } from "@/app/api/gatherings/[id]/participants/[participantId]/route";
import { GET, POST } from "@/app/api/gatherings/[id]/expenses/route";
import { DELETE, PATCH } from "@/app/api/gatherings/[id]/expenses/[expenseId]/route";
import { copy } from "@/lib/copy";
import { describe, expect, test } from "vitest";

async function create(name: string) {
  const response = await createGathering(
    new Request("http://localhost/api/gatherings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
  return (await response.json()) as { id: string };
}

async function person(gatheringId: string, name: string) {
  const response = await addPerson(
    new Request(`http://localhost/api/gatherings/${gatheringId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    { params: Promise.resolve({ id: gatheringId }) },
  );
  return (await response.json()) as { id: number; name: string };
}

function createExpense(gatheringId: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/gatherings/${gatheringId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: gatheringId }) },
  );
}

describe("expenses API", () => {
  test("AC1 create and list with equal shares", async () => {
    const { id } = await create("饭局");
    const a = await person(id, "A");
    const b = await person(id, "B");
    const c = await person(id, "C");

    const created = await createExpense(id, {
      description: "烧烤",
      amount: "300",
      payerParticipantId: a.id,
      shareeParticipantIds: [a.id, b.id, c.id],
    });
    expect(created.status).toBe(201);
    const expense = await created.json();
    expect(expense.shares).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ participantId: a.id, amountCents: 10000 }),
        expect.objectContaining({ participantId: b.id, amountCents: 10000 }),
        expect.objectContaining({ participantId: c.id, amountCents: 10000 }),
      ]),
    );

    const listed = await GET(new Request("http://x"), { params: Promise.resolve({ id }) });
    const { expenses } = (await listed.json()) as { expenses: typeof expense[] };
    expect(expenses).toHaveLength(1);
  });

  test("AC2 remainder on payer", async () => {
    const { id } = await create("饭局");
    const a = await person(id, "A");
    const b = await person(id, "B");
    const c = await person(id, "C");
    const created = await createExpense(id, {
      description: "饮料",
      amount: "100",
      payerParticipantId: a.id,
      shareeParticipantIds: [a.id, b.id, c.id],
    });
    const expense = await created.json();
    const byId = Object.fromEntries(expense.shares.map((s: { participantId: number; amountCents: number }) => [s.participantId, s.amountCents]));
    expect(byId[a.id]).toBe(3334);
    expect(byId[b.id]).toBe(3333);
    expect(byId[c.id]).toBe(3333);
  });

  test("AC4–AC5 validation", async () => {
    const { id } = await create("饭局");
    const a = await person(id, "A");

    const badAmount = await createExpense(id, {
      description: "x",
      amount: "0",
      payerParticipantId: a.id,
      shareeParticipantIds: [a.id],
    });
    expect(badAmount.status).toBe(400);
    expect((await badAmount.json()).error).toBe(copy.amountInvalid);

    const noDesc = await createExpense(id, {
      description: "  ",
      amount: "10",
      payerParticipantId: a.id,
      shareeParticipantIds: [a.id],
    });
    expect((await noDesc.json()).error).toBe(copy.descriptionRequired);

    const noSharees = await createExpense(id, {
      description: "x",
      amount: "10",
      payerParticipantId: a.id,
      shareeParticipantIds: [],
    });
    expect((await noSharees.json()).error).toBe(copy.shareesRequired);
  });

  test("AC6 edit and AC7 delete", async () => {
    const { id } = await create("饭局");
    const a = await person(id, "A");
    const b = await person(id, "B");
    const c = await person(id, "C");
    const created = await createExpense(id, {
      description: "烧烤",
      amount: "300",
      payerParticipantId: a.id,
      shareeParticipantIds: [a.id, b.id, c.id],
    });
    const { id: expenseId } = (await created.json()) as { id: number };

    const updated = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "烧烤",
          amount: "90",
          payerParticipantId: a.id,
          shareeParticipantIds: [a.id, b.id, c.id],
        }),
      }),
      { params: Promise.resolve({ id, expenseId: String(expenseId) }) },
    );
    const patched = await updated.json();
    expect(patched.amountCents).toBe(9000);
    expect(patched.shares.every((s: { amountCents: number }) => s.amountCents === 3000)).toBe(true);

    const drink = await createExpense(id, {
      description: "饮料",
      amount: "100",
      payerParticipantId: a.id,
      shareeParticipantIds: [a.id, b.id, c.id],
    });
    const drinkId = ((await drink.json()) as { id: number }).id;

    const removed = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ id, expenseId: String(drinkId) }),
    });
    expect(removed.status).toBe(200);

    const listed = await GET(new Request("http://x"), { params: Promise.resolve({ id }) });
    const { expenses } = (await listed.json()) as { expenses: { id: number }[] };
    expect(expenses.map((entry) => entry.id)).toEqual([expenseId]);
  });

  test("person deletable after removed from all expenses", async () => {
    const { id } = await create("饭局");
    const a = await person(id, "A");
    const b = await person(id, "B");
    const created = await createExpense(id, {
      description: "饭",
      amount: "50",
      payerParticipantId: a.id,
      shareeParticipantIds: [a.id, b.id],
    });
    const expenseId = ((await created.json()) as { id: number }).id;

    let blocked = await deletePerson(new Request("http://x"), {
      params: Promise.resolve({ id, participantId: String(a.id) }),
    });
    expect(blocked.status).toBe(409);

    await PATCH(
      new Request("http://x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "饭",
          amount: "50",
          payerParticipantId: b.id,
          shareeParticipantIds: [b.id],
        }),
      }),
      { params: Promise.resolve({ id, expenseId: String(expenseId) }) },
    );

    blocked = await deletePerson(new Request("http://x"), {
      params: Promise.resolve({ id, participantId: String(a.id) }),
    });
    expect(blocked.status).toBe(200);
  });
});
