import type { CardType, Difficulty, Flashcard, ReviewRecord } from "../types";
import {
  buildStudyQueue,
  isDueNow,
  isNewCard,
  latestReviewForCard,
} from "./reviewScheduling";

export type StudyScope = "queue" | "due" | "new" | "favorites" | "difficult" | "all";

export interface StudyFilters {
  scope: StudyScope;
  type: CardType | "all";
  difficulty: Difficulty | "all";
  query: string;
}

export const defaultStudyFilters: StudyFilters = {
  scope: "queue",
  type: "all",
  difficulty: "all",
  query: "",
};

export const studyScopeLabels: Record<StudyScope, string> = {
  queue: "Fila do dia",
  due: "Vencidos",
  new: "Novos",
  favorites: "Favoritos",
  difficult: "Cards difíceis",
  all: "Todos os cards",
};

export function stripCloze(text: string) {
  return text.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, "$1");
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function cardSearchHaystack(card: Flashcard) {
  return normalizeSearchText([
    stripCloze(card.question),
    card.answer,
    card.explanation || "",
    card.topic,
    card.learningObjective || "",
    ...(card.tags || []),
  ].join(" "));
}

export function cardMatchesQuery(card: Flashcard, query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return true;
  return normalized
    .split(" ")
    .filter(Boolean)
    .every((term) => cardSearchHaystack(card).includes(term));
}

export function filterCardAttributes(cards: Flashcard[], filters: StudyFilters) {
  return cards.filter((card) => {
    if (filters.type !== "all" && card.type !== filters.type) return false;
    if (filters.difficulty !== "all" && card.difficulty !== filters.difficulty) return false;
    if (!cardMatchesQuery(card, filters.query)) return false;
    return true;
  });
}

export function buildFilteredStudyQueue(
  cards: Flashcard[],
  reviews: ReviewRecord[],
  filters: StudyFilters,
  now = new Date(),
) {
  const filtered = filterCardAttributes(cards, filters);

  switch (filters.scope) {
    case "queue":
      return buildStudyQueue(filtered, reviews, now);
    case "due":
      return filtered
        .filter((card) => !isNewCard(reviews, card.id) && isDueNow(reviews, card.id, now))
        .sort((a, b) => {
          const aDate = latestReviewForCard(reviews, a.id)?.nextReviewAt || "";
          const bDate = latestReviewForCard(reviews, b.id)?.nextReviewAt || "";
          return new Date(aDate || 0).getTime() - new Date(bDate || 0).getTime();
        });
    case "new":
      return filtered
        .filter((card) => isNewCard(reviews, card.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "favorites":
      return filtered.filter((card) => Boolean(card.isFavorite));
    case "difficult":
      return filtered.filter((card) => {
        const latest = latestReviewForCard(reviews, card.id);
        return latest?.rating === "again" || latest?.rating === "hard";
      });
    case "all":
    default:
      return filtered;
  }
}

export function countCardsForScope(
  cards: Flashcard[],
  reviews: ReviewRecord[],
  scope: StudyScope,
  now = new Date(),
) {
  return buildFilteredStudyQueue(cards, reviews, {
    ...defaultStudyFilters,
    scope,
  }, now).length;
}
