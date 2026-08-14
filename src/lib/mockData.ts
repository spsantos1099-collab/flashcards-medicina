// Dados fictícios mantidos apenas para visualizar as telas de decks/estudo.
// O perfil do usuário já é real (Realtime Database) desde a Fase 3.
// Decks/cards serão substituídos por dados reais nas próximas fases.
import type { Deck, Flashcard, DashboardSummary } from "../types";

export const mockSummary: DashboardSummary = {
  dueToday: 128,
  newCards: 34,
  studiedToday: 76,
  streakDays: 8,
};

export const mockDecks: Deck[] = [
  {
    id: "cardiologia",
    title: "Cardiologia",
    specialty: "Cardiologia",
    totalCards: 142,
    dueToday: 32,
    newCards: 14,
    learnedCards: 96,
    creationMode: "upload",
    sourceDocumentName: "Diretriz Brasileira de Insuficiência Cardíaca.pdf",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "neurologia",
    title: "Neurologia",
    specialty: "Neurologia",
    totalCards: 86,
    dueToday: 14,
    newCards: 9,
    learnedCards: 63,
    creationMode: "research",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pneumologia",
    title: "Pneumologia",
    specialty: "Pneumologia",
    totalCards: 117,
    dueToday: 28,
    newCards: 11,
    learnedCards: 78,
    creationMode: "upload",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "infectologia",
    title: "Infectologia",
    specialty: "Infectologia",
    totalCards: 73,
    dueToday: 6,
    newCards: 3,
    learnedCards: 64,
    creationMode: "research",
    updatedAt: new Date().toISOString(),
  },
];

export const mockCards: Flashcard[] = [
  {
    id: "c1",
    deckId: "cardiologia",
    type: "basic",
    question: "Qual fração de ejeção caracteriza IC com fração de ejeção reduzida, segundo o material?",
    answer: "FEVE ≤ 40%.",
    topic: "Cardiologia · Insuficiência Cardíaca",
    tags: ["ICFEr"],
    difficulty: "medium",
    sources: [
      {
        id: "src-c1-1",
        kind: "upload",
        title: "Diretriz Brasileira de Insuficiência Cardíaca.pdf",
        page: 18,
        section: "Classificação",
        verificationStatus: "user_material",
      },
    ],
    createdAt: new Date().toISOString(),
  },
];
