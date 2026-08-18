import { createEmptyCard, fsrs, Rating, State, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { Flashcard, ReviewRating, ReviewRecord, SpacedRepetitionState } from "../types";

const scheduler = fsrs();

function ratingToFsrs(rating: ReviewRating): Grade {
  switch (rating) {
    case "again":
      return Rating.Again;
    case "hard":
      return Rating.Hard;
    case "good":
      return Rating.Good;
    case "easy":
      return Rating.Easy;
  }
}

export function serializeFsrsCard(card: FsrsCard): SpacedRepetitionState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as SpacedRepetitionState["state"],
    lastReview: card.last_review?.toISOString(),
  };
}

export function deserializeFsrsCard(state: SpacedRepetitionState): FsrsCard {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
  };
}

function sortedReviews(reviews: ReviewRecord[]) {
  return [...reviews].sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime());
}

/**
 * Reconstrói o estado do FSRS para cards criados antes da Fase 10.
 * Assim, avaliações salvas na Fase 9 continuam servindo como histórico.
 */
export function rebuildFsrsState(card: Flashcard, reviews: ReviewRecord[]): FsrsCard {
  const cardReviews = sortedReviews(reviews.filter((review) => review.cardId === card.id));
  const origin = card.createdAt || cardReviews[0]?.reviewedAt || new Date().toISOString();
  let state = createEmptyCard(new Date(origin));

  for (const review of cardReviews) {
    const reviewedAt = new Date(review.reviewedAt);
    if (Number.isNaN(reviewedAt.getTime())) continue;
    state = scheduler.next(state, reviewedAt, ratingToFsrs(review.rating)).card;
  }

  return state;
}

export function scheduleReview(
  card: Flashcard,
  reviews: ReviewRecord[],
  rating: ReviewRating,
  now = new Date(),
) {
  const current = card.srs ? deserializeFsrsCard(card.srs) : rebuildFsrsState(card, reviews);
  const result = scheduler.next(current, now, ratingToFsrs(rating));
  const nextState = serializeFsrsCard(result.card);

  return {
    nextState,
    nextReviewAt: nextState.due,
    scheduledDays: nextState.scheduledDays,
    stability: nextState.stability,
    memoryDifficulty: nextState.difficulty,
    schedulerState: nextState.state,
  };
}
