// Dados fictícios mantidos temporariamente SOMENTE nas telas que dependem
// de flashcards gerados pela IA. Decks e perfil já usam Realtime Database.
import type { Flashcard } from "../types";

export const mockCards: Flashcard[] = [
  {
    id: "c1",
    deckId: "preview",
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
