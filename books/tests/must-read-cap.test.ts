import { POST as createList } from "../app/api/book-lists/route";
import { POST as addMember } from "../app/api/book-lists/[id]/members/route";
import { GET, POST as postBook } from "../app/api/book-lists/[id]/books/route";
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

function listBooks(listId: string, memberId: number) {
  return GET(new Request(`http://localhost/api/book-lists/${listId}/books?memberId=${memberId}`), {
    params: Promise.resolve({ id: listId }),
  });
}

const FIVE_MUST_READS = ["三体", "活着", "百年孤独", "人类简史", "红楼梦"] as const;

describe("must-read cap (5 per member)", () => {
  test("AC1 blocks 6th must-read and lists existing five", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    for (const title of FIVE_MUST_READS) {
      const res = await addBook(id, jackey, title, 3);
      expect(res.status).toBe(201);
    }

    const weiCheng = await addBook(id, jackey, "围城", 2);
    const weiBody = (await weiCheng.json()) as { book: { id: number } };

    const blocked = await rateBook(id, weiBody.book.id, jackey, 3);
    expect(blocked.status).toBe(400);
    const err = (await blocked.json()) as { error: string };
    expect(err.error).toContain("最多 5 本必读");
    for (const title of FIVE_MUST_READS) {
      expect(err.error).toContain(title);
    }
    expect(err.error).not.toContain("围城");

    const listed = (await (await listBooks(id, jackey)).json()) as {
      books: { title: string; myScore: number | null }[];
    };
    const wei = listed.books.find((book) => book.title === "围城");
    expect(wei?.myScore).toBe(2);
  });

  test("AC2 demote frees slot for new must-read", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    for (const title of FIVE_MUST_READS) {
      await addBook(id, jackey, title, 3);
    }
    const weiRes = await addBook(id, jackey, "围城", 2);
    const { book: weiBook } = (await weiRes.json()) as { book: { id: number } };

    const listedBefore = (await (await listBooks(id, jackey)).json()) as {
      books: { id: number; title: string; myScore: number | null }[];
    };
    const honglou = listedBefore.books.find((book) => book.title === "红楼梦");
    expect(honglou).toBeDefined();

    await rateBook(id, honglou!.id, jackey, 2);

    const ok = await rateBook(id, weiBook.id, jackey, 3);
    expect(ok.status).toBe(200);

    const listed = (await (await listBooks(id, jackey)).json()) as {
      books: { title: string; myScore: number | null }[];
    };
    const mustReads = listed.books.filter((book) => book.myScore === 3).map((book) => book.title);
    expect(mustReads).toHaveLength(5);
    expect(mustReads).toContain("围城");
    expect(mustReads).not.toContain("红楼梦");
  });

  test("AC3 demoting existing must-read is never blocked at cap", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    for (const title of FIVE_MUST_READS) {
      await addBook(id, jackey, title, 3);
    }

    const listed = (await (await listBooks(id, jackey)).json()) as {
      books: { id: number; title: string }[];
    };
    const santi = listed.books.find((book) => book.title === "三体");
    expect(santi).toBeDefined();

    const demote = await rateBook(id, santi!.id, jackey, 2);
    expect(demote.status).toBe(200);
  });

  test("AC6 per-member cap: Jackey full does not block 小红", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");
    const xiaohong = await seedMember(id, "小红");

    for (const title of FIVE_MUST_READS) {
      await addBook(id, jackey, title, 3);
    }

    const forHong = await addBook(id, xiaohong, "三体", 3);
    expect(forHong.status).toBe(201);
  });

  test("AC7 add book with score 3 blocked when already at cap", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    for (const title of FIVE_MUST_READS) {
      await addBook(id, jackey, title, 3);
    }

    const blocked = await addBook(id, jackey, "围城", 3);
    expect(blocked.status).toBe(400);
    const err = (await blocked.json()) as { error: string };
    expect(err.error).toContain("最多 5 本必读");
    expect(err.error).toBe(copy.mustReadCapExceeded([...FIVE_MUST_READS]));
  });

  test("AC5 concurrent fifth must-read: at most one succeeds", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    const four = FIVE_MUST_READS.slice(0, 4);
    for (const title of four) {
      await addBook(id, jackey, title, 3);
    }
    const a = await addBook(id, jackey, "围城", 2);
    const b = await addBook(id, jackey, "挪威的森林", 2);
    const { book: wei } = (await a.json()) as { book: { id: number } };
    const { book: mu } = (await b.json()) as { book: { id: number } };

    const [r1, r2] = await Promise.all([
      rateBook(id, wei.id, jackey, 3),
      rateBook(id, mu.id, jackey, 3),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 400]);

    const listed = (await (await listBooks(id, jackey)).json()) as {
      books: { myScore: number | null }[];
    };
    const mustReadCount = listed.books.filter((book) => book.myScore === 3).length;
    expect(mustReadCount).toBe(5);
  });

  test("AC7 first-time 3 on unrated book blocked at cap", async () => {
    const { id } = await seedList();
    const jackey = await seedMember(id, "Jackey");

    for (const title of FIVE_MUST_READS) {
      await addBook(id, jackey, title, 3);
    }
    await addBook(id, jackey, "围城", 1);

    const listed = (await (await listBooks(id, jackey)).json()) as {
      books: { id: number; title: string }[];
    };
    const wei = listed.books.find((book) => book.title === "围城");
    const blocked = await rateBook(id, wei!.id, jackey, 3);
    expect(blocked.status).toBe(400);
  });
});
