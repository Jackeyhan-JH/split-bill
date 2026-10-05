import { POST as createList } from "../app/api/book-lists/route";
import { POST as addMember } from "../app/api/book-lists/[id]/members/route";
import { GET, POST } from "../app/api/book-lists/[id]/books/route";
import {
  DELETE as revokeRating,
  PUT as setRating,
} from "../app/api/book-lists/[id]/books/[bookId]/ratings/route";
import { normalizeTitleKey } from "../lib/book-scores";
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

async function seedMember(listId: string, name: string) {
  const response = await addMember(
    new Request(`http://localhost/api/book-lists/${listId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    { params: Promise.resolve({ id: listId }) },
  );
  const body = (await response.json()) as { member: { id: number } };
  return body.member.id;
}

function postBook(listId: string, memberId: number, title: string, score?: number) {
  return POST(
    new Request(`http://localhost/api/book-lists/${listId}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, title, ...(score !== undefined ? { score } : {}) }),
    }),
    { params: Promise.resolve({ id: listId }) },
  );
}

function listBooksApi(listId: string, memberId?: number) {
  const query = memberId !== undefined ? `?memberId=${memberId}` : "";
  return GET(new Request(`http://localhost/api/book-lists/${listId}/books${query}`), {
    params: Promise.resolve({ id: listId }),
  });
}

describe("books API", () => {
  test("normalizeTitleKey trims and lowercases", () => {
    expect(normalizeTitleKey("  三体  ")).toBe("三体");
    expect(normalizeTitleKey("Dune")).toBe("dune");
    expect(normalizeTitleKey("  DUNE ")).toBe("dune");
  });

  test("AC1 add book with score; AC3 dedupe keeps first title spelling", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    const created = await postBook(id, jackey, "三体", 3);
    expect(created.status).toBe(201);
    const bookBody = (await created.json()) as { book: { title: string; myScore: number } };
    expect(bookBody.book.title).toBe("三体");
    expect(bookBody.book.myScore).toBe(3);

    const dup = await postBook(id, jackey, "  三体  ", 2);
    expect(dup.status).toBe(201);
    const dupBody = (await dup.json()) as { book: { title: string; myScore: number } };
    expect(dupBody.book.title).toBe("三体");
    expect(dupBody.book.myScore).toBe(2);

    const listed = await listBooksApi(id, jackey);
    const listBody = (await listed.json()) as { books: { title: string; myScore: number }[] };
    expect(listBody.books).toHaveLength(1);
    expect(listBody.books[0]?.title).toBe("三体");
    expect(listBody.books[0]?.myScore).toBe(2);
  });

  test("AC2 change and revoke rating; book remains after revoke", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");
    const created = await postBook(id, jackey, "三体", 3);
    const { book } = (await created.json()) as { book: { id: number } };

    const updated = await setRating(
      new Request(`http://localhost/api/book-lists/${id}/books/${book.id}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: jackey, score: 2 }),
      }),
      { params: Promise.resolve({ id, bookId: String(book.id) }) },
    );
    expect(updated.status).toBe(200);

    const revoked = await revokeRating(
      new Request(`http://localhost/api/book-lists/${id}/books/${book.id}/ratings?memberId=${jackey}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id, bookId: String(book.id) }) },
    );
    expect(revoked.status).toBe(200);
    const revokedBody = (await revoked.json()) as { book: { myScore: null } };
    expect(revokedBody.book.myScore).toBeNull();

    const listed = await listBooksApi(id, jackey);
    const listBody = (await listed.json()) as { books: { title: string; myScore: null }[] };
    expect(listBody.books).toHaveLength(1);
    expect(listBody.books[0]?.myScore).toBeNull();
  });

  test("AC4 independent scores per member; AC5 re-rating updates single record", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");
    const xiaohong = await seedMember(id, "小红");
    const aming = await seedMember(id, "阿明");

    const created = await postBook(id, jackey, "三体", 3);
    const { book } = (await created.json()) as { book: { id: number } };

    await setRating(
      new Request(`http://localhost/api/book-lists/${id}/books/${book.id}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: xiaohong, score: 1 }),
      }),
      { params: Promise.resolve({ id, bookId: String(book.id) }) },
    );

    const jackeyList = (await (await listBooksApi(id, jackey)).json()) as {
      books: { myScore: number }[];
    };
    const xiaohongList = (await (await listBooksApi(id, xiaohong)).json()) as {
      books: { myScore: number }[];
    };
    const amingList = (await (await listBooksApi(id, aming)).json()) as {
      books: { myScore: null }[];
    };

    expect(jackeyList.books[0]?.myScore).toBe(3);
    expect(xiaohongList.books[0]?.myScore).toBe(1);
    expect(amingList.books[0]?.myScore).toBeNull();

    await setRating(
      new Request(`http://localhost/api/book-lists/${id}/books/${book.id}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: jackey, score: 2 }),
      }),
      { params: Promise.resolve({ id, bookId: String(book.id) }) },
    );
    const after = (await (await listBooksApi(id, jackey)).json()) as { books: { myScore: number }[] };
    expect(after.books[0]?.myScore).toBe(2);
  });

  test("AC6 member required to add book", async () => {
    const { id } = await seedList();
    const missingMember = await postBook(id, 9999, "三体", 3);
    expect(missingMember.status).toBe(400);

    const noMember = await POST(
      new Request(`http://localhost/api/book-lists/${id}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "三体" }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(noMember.status).toBe(400);
  });
});
