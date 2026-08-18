import type { Flashcard, ReviewRecord } from "../types";

export function sortReviewsAscending(reviews: ReviewRecord[]) {
  return [...reviews].sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime());
}

export function reviewsForCard(reviews: ReviewRecord[], cardId: string) {
  return sortReviewsAscending(reviews.filter((review) => review.cardId === cardId));
}

export function latestReviewForCard(reviews: ReviewRecord[], cardId: string) {
  const cardReviews = reviewsForCard(reviews, cardId);
  return cardReviews.length ? cardReviews[cardReviews.length - 1] : undefined;
}

/**
 * Cards estudados antes da Fase 10 não têm nextReviewAt.
 * Eles entram uma única vez na fila como "vencidos"; a próxima avaliação
 * grava o agendamento FSRS completo.
 */
export function nextDueDateForCard(reviews: ReviewRecord[], cardId: string): Date | null {
  const latest = latestReviewForCard(reviews, cardId);
  if (!latest) return null;
  if (!latest.nextReviewAt) return new Date(0);
  const due = new Date(latest.nextReviewAt);
  return Number.isNaN(due.getTime()) ? new Date(0) : due;
}

export function isNewCard(reviews: ReviewRecord[], cardId: string) {
  return !latestReviewForCard(reviews, cardId);
}

export function isDueNow(reviews: ReviewRecord[], cardId: string, now = new Date()) {
  const due = nextDueDateForCard(reviews, cardId);
  return Boolean(due && due.getTime() <= now.getTime());
}

export function isDueByEndOfToday(reviews: ReviewRecord[], cardId: string, now = new Date()) {
  const due = nextDueDateForCard(reviews, cardId);
  if (!due) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return due.getTime() <= end.getTime();
}

export function buildStudyQueue(cards: Flashcard[], reviews: ReviewRecord[], now = new Date()) {
  const due = cards
    .filter((card) => !isNewCard(reviews, card.id) && isDueNow(reviews, card.id, now))
    .sort((a, b) => {
      const aDue = nextDueDateForCard(reviews, a.id)?.getTime() ?? 0;
      const bDue = nextDueDateForCard(reviews, b.id)?.getTime() ?? 0;
      return aDue - bDue;
    });

  const fresh = cards
    .filter((card) => isNewCard(reviews, card.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return [...due, ...fresh];
}

export function nextScheduledDate(cards: Flashcard[], reviews: ReviewRecord[], now = new Date()) {
  const candidates = cards
    .map((card) => nextDueDateForCard(reviews, card.id))
    .filter((value): value is Date => Boolean(value && value.getTime() > now.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] ?? null;
}
