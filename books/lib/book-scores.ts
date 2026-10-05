import { copy } from "./copy";

export type BookScore = 1 | 2 | 3;

export type BookRow = {
  id: number;
  title: string;
  myScore: BookScore | null;
};

export function normalizeTitleKey(raw: string): string {
  return raw.trim().toLocaleLowerCase();
}

export function scoreLabel(score: BookScore): string {
  if (score === 3) return copy.scoreMustRead;
  if (score === 2) return copy.scoreRecommend;
  return copy.scoreBoring;
}
