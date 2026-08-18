import type { Deck, Flashcard, ReviewRating, ReviewRecord } from "../types";

export type AnalyticsPeriod = "7d" | "30d" | "all";

export interface RatingCounts {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface DailyActivityPoint {
  key: string;
  label: string;
  reviews: number;
  uniqueCards: number;
}

export interface DeckPerformanceRow {
  deckId: string;
  deckTitle: string;
  specialty: string;
  reviews: number;
  uniqueCards: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  noErrorRate: number | null;
  secureRate: number | null;
  lastReviewedAt?: string;
}

export interface DifficultCardMetric {
  card: Flashcard;
  deck: Deck | undefined;
  reviews: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  score: number;
  lastReviewedAt: string | undefined;
  latestRating: ReviewRating | undefined;
}

export function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function reviewsInPeriod(reviews: ReviewRecord[], period: AnalyticsPeriod, now = new Date()) {
  if (period === "all") return reviews;
  const days = period === "7d" ? 7 : 30;
  const start = startOfLocalDay(now);
  start.setDate(start.getDate() - (days - 1));
  return reviews.filter((review) => {
    const timestamp = new Date(review.reviewedAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= now.getTime();
  });
}

export function ratingCounts(reviews: ReviewRecord[]): RatingCounts {
  return reviews.reduce<RatingCounts>(
    (counts, review) => {
      counts[review.rating] += 1;
      return counts;
    },
    { again: 0, hard: 0, good: 0, easy: 0 },
  );
}

export function percentage(numerator: number, denominator: number) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 100);
}

export function streakFromReviews(reviews: ReviewRecord[], now = new Date()) {
  const activeDays = new Set(reviews.map((review) => localDateKey(review.reviewedAt)).filter(Boolean));
  if (activeDays.size === 0) return 0;

  let cursor = new Date(now);
  let streak = 0;
  if (!activeDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function dailyActivity(reviews: ReviewRecord[], days = 7, now = new Date()): DailyActivityPoint[] {
  const formatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const byDay = new Map<string, ReviewRecord[]>();

  reviews.forEach((review) => {
    const key = localDateKey(review.reviewedAt);
    if (!key) return;
    const current = byDay.get(key) || [];
    current.push(review);
    byDay.set(key, current);
  });

  return Array.from({ length: days }, (_, index) => {
    const date = startOfLocalDay(now);
    date.setDate(date.getDate() - (days - 1 - index));
    const key = localDateKey(date);
    const items = byDay.get(key) || [];
    return {
      key,
      label: formatter.format(date).replace(".", ""),
      reviews: items.length,
      uniqueCards: new Set(items.map((review) => review.cardId)).size,
    };
  });
}

export function deckPerformance(
  reviews: ReviewRecord[],
  decks: Deck[],
): DeckPerformanceRow[] {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const grouped = new Map<string, ReviewRecord[]>();

  reviews.forEach((review) => {
    const current = grouped.get(review.deckId) || [];
    current.push(review);
    grouped.set(review.deckId, current);
  });

  return Array.from(grouped.entries())
    .map(([deckId, items]) => {
      const deck = deckById.get(deckId);
      const counts = ratingCounts(items);
      const sorted = [...items].sort(
        (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime(),
      );
      return {
        deckId,
        deckTitle: deck?.title || "Deck removido",
        specialty: deck?.specialty || "Sem especialidade",
        reviews: items.length,
        uniqueCards: new Set(items.map((review) => review.cardId)).size,
        ...counts,
        noErrorRate: percentage(items.length - counts.again, items.length),
        secureRate: percentage(counts.good + counts.easy, items.length),
        lastReviewedAt: sorted[0]?.reviewedAt,
      };
    })
    .sort((a, b) => b.reviews - a.reviews);
}

export function difficultCardMetrics(
  reviews: ReviewRecord[],
  cards: Flashcard[],
  decks: Deck[],
): DifficultCardMetric[] {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const grouped = new Map<string, ReviewRecord[]>();

  reviews.forEach((review) => {
    const current = grouped.get(review.cardId) || [];
    current.push(review);
    grouped.set(review.cardId, current);
  });

  return Array.from(grouped.entries())
    .flatMap(([cardId, items]) => {
      const card = cardById.get(cardId);
      if (!card) return [];
      const counts = ratingCounts(items);
      const sorted = [...items].sort(
        (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime(),
      );
      // Peso maior para erro explícito; Difícil também conta, mas menos.
      // Bom/Fácil reduzem discretamente o peso para não eternizar cards já dominados.
      const score = Math.max(0, counts.again * 3 + counts.hard - counts.good * 0.35 - counts.easy * 0.6);
      if (score <= 0) return [];

      const metric: DifficultCardMetric = {
        card,
        deck: deckById.get(card.deckId),
        reviews: items.length,
        ...counts,
        score,
        lastReviewedAt: sorted[0]?.reviewedAt,
        latestRating: sorted[0]?.rating,
      };
      return [metric];
    })
    .sort((a, b) => b.score - a.score || b.again - a.again || b.hard - a.hard);
}
