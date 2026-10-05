import { POST as createList } from "../app/api/book-lists/route";
import { POST as addMember } from "../app/api/book-lists/[id]/members/route";
import { GET, POST } from "../app/api/book-lists/[id]/books/route";
import { PUT as setRating } from "../app/api/book-lists/[id]/books/[bookId]/ratings/route";
import {
  collectiveTierLines,
  sortCollectiveBooks,
  sortPersonalGroup,
} from "../lib/shelf";
import type { BookRow } from "../lib/book-scores";
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

function bookFixture(
  id: number,
  title: string,
  createdAt: string,
  ratings: BookRow["ratings"],
): BookRow {
  return { id, title, createdAt, ratings, myScore: null };
}

describe("collective shelf sort", () => {
  const members = [
    { id: 1, name: "阿明" },
    { id: 2, name: "小红" },
    { id: 3, name: "Jackey" },
  ];

  test("AC3 fixture order and tier lines", () => {
    const books: BookRow[] = [
      bookFixture(1, "三体", "2020-01-01T00:00:00.000Z", [
        { memberId: 3, score: 3, ratedAt: "2020-01-02T00:00:00.000Z" },
        { memberId: 2, score: 3, ratedAt: "2020-01-03T00:00:00.000Z" },
        { memberId: 1, score: 2, ratedAt: "2020-01-04T00:00:00.000Z" },
      ]),
      bookFixture(2, "活着", "2020-01-05T00:00:00.000Z", [
        { memberId: 3, score: 3, ratedAt: "2020-01-06T00:00:00.000Z" },
        { memberId: 2, score: 1, ratedAt: "2020-01-07T00:00:00.000Z" },
      ]),
      bookFixture(3, "围城", "2020-01-08T00:00:00.000Z", [
        { memberId: 1, score: 2, ratedAt: "2020-01-09T00:00:00.000Z" },
        { memberId: 2, score: 2, ratedAt: "2020-01-10T00:00:00.000Z" },
      ]),
      bookFixture(4, "红楼梦", "2020-01-11T00:00:00.000Z", [
        { memberId: 3, score: 1, ratedAt: "2020-01-12T00:00:00.000Z" },
      ]),
      bookFixture(5, "聊斋", "2020-01-13T00:00:00.000Z", [
        { memberId: 2, score: 1, ratedAt: "2020-01-14T00:00:00.000Z" },
      ]),
    ];

    const sorted = sortCollectiveBooks(books);
    expect(sorted.map((book) => book.title)).toEqual(["三体", "活着", "围城", "红楼梦", "聊斋"]);
    expect(collectiveTierLines(sorted[0]!, members)).toEqual([
      "必读(3)：小红、Jackey",
      "推荐阅读(2)：阿明",
    ]);
  });

  test("AC4 personal group order by latest rating time", () => {
    const books: BookRow[] = [
      bookFixture(1, "三体", "t0", [{ memberId: 2, score: 3, ratedAt: "2020-05-01T00:00:00.000Z" }]),
      bookFixture(2, "围城", "t1", [{ memberId: 2, score: 2, ratedAt: "2020-04-01T00:00:00.000Z" }]),
      bookFixture(3, "活着", "t2", [{ memberId: 2, score: 1, ratedAt: "2020-06-01T00:00:00.000Z" }]),
      bookFixture(4, "聊斋", "t3", [{ memberId: 2, score: 1, ratedAt: "2020-03-01T00:00:00.000Z" }]),
    ];
    const boring = sortPersonalGroup(books, 2, 1);
    expect(boring.map((book) => book.title)).toEqual(["活着", "聊斋"]);
    expect(sortPersonalGroup(books, 2, 3).map((book) => book.title)).toEqual(["三体"]);
    expect(sortPersonalGroup(books, 2, 2).map((book) => book.title)).toEqual(["围城"]);
  });
});

describe("collective shelf integration", () => {
  test("API returns ratings and createdAt for AC3 seed", async () => {
    const { id } = await seedList();
    const aming = await seedMember(id, "阿明");
    const xiaohong = await seedMember(id, "小红");
    const jackey = await seedMember(id, "Jackey");

    const santi = (await (await postBook(id, jackey, "三体", 3)).json()) as { book: { id: number } };
    await setRating(
      new Request(`http://localhost/api/book-lists/${id}/books/${santi.book.id}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: xiaohong, score: 3 }),
      }),
      { params: Promise.resolve({ id, bookId: String(santi.book.id) }) },
    );
    await setRating(
      new Request(`http://localhost/api/book-lists/${id}/books/${santi.book.id}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: aming, score: 2 }),
      }),
      { params: Promise.resolve({ id, bookId: String(santi.book.id) }) },
    );

    await postBook(id, jackey, "活着", 3);
    await postBook(id, xiaohong, "活着", 1);
    await postBook(id, aming, "围城", 2);
    await postBook(id, xiaohong, "围城", 2);
    await postBook(id, jackey, "红楼梦", 1);
    await postBook(id, xiaohong, "聊斋", 1);

    const body = (await (await listBooksApi(id, jackey)).json()) as { books: BookRow[] };
    const members = [
      { id: aming, name: "阿明" },
      { id: xiaohong, name: "小红" },
      { id: jackey, name: "Jackey" },
    ];
    const sorted = sortCollectiveBooks(body.books);
    expect(sorted.map((book) => book.title)).toEqual(["三体", "活着", "围城", "红楼梦", "聊斋"]);
    expect(collectiveTierLines(sorted[0]!, members)).toContain("必读(3)：小红、Jackey");
  });
});
