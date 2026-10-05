import { scoreLabel, type BookRating, type BookRow, type BookScore } from "./book-scores";

export type ShelfMember = { id: number; name: string };

function countTier(ratings: BookRating[], score: BookScore): number {
  return ratings.filter((rating) => rating.score === score).length;
}

/** Collective shelf: tier counts (3→2→1) desc, then earliest add time asc. */
export function compareCollectiveBooks(a: BookRow, b: BookRow): number {
  for (const score of [3, 2, 1] as const) {
    const diff = countTier(b.ratings, score) - countTier(a.ratings, score);
    if (diff !== 0) return diff;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

export function sortCollectiveBooks(books: BookRow[]): BookRow[] {
  return [...books].sort(compareCollectiveBooks);
}

const MEMBER_ORDER = (members: ShelfMember[]) =>
  new Map(members.map((member, index) => [member.id, index]));

export function memberNamesInTier(
  ratings: BookRating[],
  score: BookScore,
  members: ShelfMember[],
): string[] {
  const order = MEMBER_ORDER(members);
  return ratings
    .filter((rating) => rating.score === score)
    .sort((left, right) => (order.get(left.memberId) ?? 0) - (order.get(right.memberId) ?? 0))
    .map((rating) => members.find((member) => member.id === rating.memberId)?.name ?? "")
    .filter((name) => name.length > 0);
}

export function collectiveTierLines(book: BookRow, members: ShelfMember[]): string[] {
  const lines: string[] = [];
  for (const score of [3, 2, 1] as const) {
    const names = memberNamesInTier(book.ratings, score, members);
    if (names.length === 0) continue;
    lines.push(`${scoreLabel(score)}(${score})：${names.join("、")}`);
  }
  return lines;
}

export function ratingForMember(book: BookRow, memberId: number): BookRating | null {
  return book.ratings.find((rating) => rating.memberId === memberId) ?? null;
}

export function booksRatedByMember(books: BookRow[], memberId: number): BookRow[] {
  return books.filter((book) => ratingForMember(book, memberId) !== null);
}

export function sortPersonalGroup(
  books: BookRow[],
  memberId: number,
  score: BookScore,
): BookRow[] {
  return books
    .filter((book) => ratingForMember(book, memberId)?.score === score)
    .sort((left, right) => {
      const leftAt = ratingForMember(left, memberId)?.ratedAt ?? "";
      const rightAt = ratingForMember(right, memberId)?.ratedAt ?? "";
      return rightAt.localeCompare(leftAt);
    });
}

export function mustReadCountForMember(books: BookRow[], memberId: number): number {
  return books.filter((book) => ratingForMember(book, memberId)?.score === 3).length;
}
