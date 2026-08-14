// Tipos de domínio da plataforma. Ainda não ligados ao Firebase (isso entra na Fase 3,
// quando desenharmos a estrutura real do Realtime Database).

export type CardType = "basic" | "cloze" | "clinical_case";
export type Difficulty = "easy" | "medium" | "hard";
export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface CardSource {
  documentName: string;
  page?: number;
  section?: string;
  excerpt?: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  type: CardType;
  question: string;
  answer: string;
  explanation?: string;
  topic: string;
  tags: string[];
  difficulty: Difficulty;
  source?: CardSource;
  isFavorite?: boolean;
  createdAt: string;
}

export interface Deck {
  id: string;
  title: string;
  specialty: string;
  topic?: string;
  totalCards: number;
  dueToday: number;
  newCards: number;
  learnedCards: number;
  sourceDocumentName?: string;
  updatedAt: string;
}

export interface DashboardSummary {
  dueToday: number;
  newCards: number;
  studiedToday: number;
  streakDays: number;
}
