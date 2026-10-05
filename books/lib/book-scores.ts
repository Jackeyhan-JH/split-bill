import { copy } from "./copy";

export const MUST_READ_MAX = 5;

export type BookScore = 1 | 2 | 3;

export type BookRating = {
  memberId: number;
  score: BookScore;
  ratedAt: string;
};

export type BookRow = {
  id: number;
  title: string;
  createdAt: string;
  myScore: BookScore | null;
  ratings: BookRating[];
};

export function normalizeTitleKey(raw: string): string {
  return raw.trim().toLocaleLowerCase();
}

export function scoreLabel(score: BookScore): string {
  if (score === 3) return copy.scoreMustRead;
  if (score === 2) return copy.scoreRecommend;
  return copy.scoreBoring;
}
