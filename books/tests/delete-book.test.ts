import { POST as createList } from "../app/api/book-lists/route";
import { POST as addMember } from "../app/api/book-lists/[id]/members/route";
import { GET, POST as postBook } from "../app/api/book-lists/[id]/books/route";
import { DELETE as deleteBookApi } from "../app/api/book-lists/[id]/books/[bookId]/route";
import { PUT as setRating } from "../app/api/book-lists/[id]/books/[bookId]/ratings/route";
import { copy } from "../lib/copy";
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

function addBook(listId: string, memberId: number, title: string, score?: number) {
  return postBook(
    new Request(`http://localhost/api/book-lists/${listId}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, title, ...(score !== undefined ? { score } : {}) }),
    }),
    { params: Promise.resolve({ id: listId }) },
  );
}

function rateBook(listId: string, bookId: number, memberId: number, score: number) {
  return setRating(
    new Request(`http://localhost/api/book-lists/${listId}/books/${bookId}/ratings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, score }),
    }),
    { params: Promise.resolve({ id: listId, bookId: String(bookId) }) },
  );
}

function deleteBook(listId: string, bookId: number, memberId?: number) {
  const query = memberId !== undefined ? `?memberId=${memberId}` : "";
  return deleteBookApi(
    new Request(`http://localhost/api/book-lists/${listId}/books/${bookId}${query}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: listId, bookId: String(bookId) }) },
  );
}

function listBooks(listId: string, memberId: number) {
  return GET(new Request(`http://localhost/api/book-lists/${listId}/books?memberId=${memberId}`), {
    params: Promise.resolve({ id: listId }),
  });
}

const JACKEY_MUST_READ_FIVE = ["三体", "活着", "百年孤独", "人类简史", "红楼梦"] as const;

describe("delete book (#20)", () => {
  test("AC1 confirm copy for 3, 1, and 0 raters", () => {
    expect(copy.deleteBookConfirm("三体", 3)).toBe(
      "《三体》已有 3 人打分，删除后这些分数一起清掉",
    );
    expect(copy.deleteBookConfirm("三体", 1)).toBe(
      "《三体》已有 1 人打分，删除后这些分数一起清掉",
    );
    expect(copy.deleteBookConfirm("三体", 0)).toBe(
      "《三体》已有 0 人打分，删除后这些分数一起清掉",
    );
  });

  test("AC3 delete removes book and all ratings for every member", async () => {
    const { id } = await seedList();
    const aming = await seedMember(id, "阿明");
    const xiaohong = await seedMember(id, "小红");
    const jackey = await seedMember(id, "Jackey");

    const created = await addBook(id, jackey, "三体", 3);
    const { book } = (await created.json()) as { book: { id: number } };
    await rateBook(id, book.id, xiaohong, 2);
    await rateBook(id, book.id, aming, 1);

    const deleted = await deleteBook(id, book.id, aming);
    expect(deleted.status).toBe(200);

    for (const memberId of [aming, xiaohong, jackey]) {
      const listed = (await (await listBooks(id, memberId)).json()) as {
        books: { title: string }[];
      };
      expect(listed.books.some((b) => b.title === "三体")).toBe(false);
    }
  });

  test("AC4 must-read slot freed after deleting a must-read book", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");
    const xiaohong = await seedMember(id, "小红");

    for (const title of JACKEY_MUST_READ_FIVE) {
      const res = await addBook(id, jackey, title, 3);
      expect(res.status).toBe(201);
    }

    const jackeyListBefore = (await (await listBooks(id, jackey)).json()) as {
      books: { id: number; title: string; myScore: number | null }[];
    };
    expect(jackeyListBefore.books.filter((b) => b.myScore === 3)).toHaveLength(5);
    const santi = jackeyListBefore.books.find((b) => b.title === "三体");
    expect(santi).toBeDefined();

    await rateBook(id, santi!.id, xiaohong, 3);

    await deleteBook(id, santi!.id, jackey);

    const jackeyListAfter = (await (await listBooks(id, jackey)).json()) as {
      books: { title: string; myScore: number | null }[];
    };
    expect(jackeyListAfter.books.filter((b) => b.myScore === 3)).toHaveLength(4);
    expect(jackeyListAfter.books.some((b) => b.title === "三体")).toBe(false);

    const weiChengAdd = await addBook(id, jackey, "围城", 2);
    const weiBody = (await weiChengAdd.json()) as { book: { id: number } };
    const rateWei = await rateBook(id, weiBody.book.id, jackey, 3);
    expect(rateWei.status).toBe(200);

    const xiaohongList = (await (await listBooks(id, xiaohong)).json()) as {
      books: { title: string; myScore: number | null }[];
    };
    expect(xiaohongList.books.filter((b) => b.myScore === 3)).toHaveLength(0);
    expect(xiaohongList.books.some((b) => b.title === "三体")).toBe(false);
  });

  test("AC5 re-adding same title after delete is a fresh book with no ratings", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    const first = await addBook(id, jackey, "三体", 3);
    const { book: firstBook } = (await first.json()) as { book: { id: number } };
    await deleteBook(id, firstBook.id, jackey);

    const second = await addBook(id, jackey, "三体");
    expect(second.status).toBe(201);
    const { book: secondBook } = (await second.json()) as {
      book: { id: number; myScore: null; ratings: unknown[] };
    };
    expect(secondBook.id).not.toBe(firstBook.id);
    expect(secondBook.myScore).toBeNull();
    expect(secondBook.ratings).toHaveLength(0);
  });

  test("AC6 identity required to delete", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");
    const created = await addBook(id, jackey, "三体", 3);
    const { book } = (await created.json()) as { book: { id: number } };

    const noMember = await deleteBook(id, book.id);
    expect(noMember.status).toBe(400);
    const err = (await noMember.json()) as { error: string };
    expect(err.error).toBe(copy.memberRequired);

    const listed = await listBooks(id, jackey);
    const listBody = (await listed.json()) as { books: { title: string }[] };
    expect(listBody.books).toHaveLength(1);
  });

  test("any member with identity can delete, not only creator", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");
    const xiaohong = await seedMember(id, "小红");
    const created = await addBook(id, jackey, "三体", 3);
    const { book } = (await created.json()) as { book: { id: number } };

    const deleted = await deleteBook(id, book.id, xiaohong);
    expect(deleted.status).toBe(200);

    const listed = (await (await listBooks(id, jackey)).json()) as { books: unknown[] };
    expect(listed.books).toHaveLength(0);
  });
});
