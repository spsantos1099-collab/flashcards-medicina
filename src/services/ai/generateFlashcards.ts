import type { User } from "firebase/auth";
import type {
  CardSource,
  CardType,
  Deck,
  Difficulty,
  ExtractedDocument,
  Flashcard,
  GenerationMeta,
  GenerationOptions,
} from "../../types";

const MAX_DOCUMENT_CHARACTERS = 120_000;

interface ApiCard {
  type: CardType;
  question: string;
  answer: string;
  explanation: string;
  topic: string;
  tags: string[];
  difficulty: Difficulty;
  sourcePage: number;
  sourceExcerpt: string;
}

interface ApiResponse {
  provider: "gemini";
  model: string;
  cards: ApiCard[];
  generatedAt: string;
}

export class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AIGenerationError";
  }
}

function temporaryId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeSource(
  document: ExtractedDocument,
  apiCard: ApiCard,
): CardSource {
  const page = document.extension === "pdf" && apiCard.sourcePage > 0
    ? apiCard.sourcePage
    : undefined;

  return {
    id: temporaryId("source"),
    kind: "upload",
    title: document.name,
    documentId: document.documentId,
    page,
    excerpt: apiCard.sourceExcerpt.trim(),
    verificationStatus: "user_material",
  };
}

function mapCard(
  deck: Deck,
  document: ExtractedDocument,
  apiCard: ApiCard,
  generatedAt: string,
): Flashcard {
  return {
    id: temporaryId("generated"),
    deckId: deck.id,
    type: apiCard.type,
    question: apiCard.question.trim(),
    answer: apiCard.answer.trim(),
    explanation: apiCard.explanation.trim() || undefined,
    topic: apiCard.topic.trim() || deck.topic || deck.title,
    tags: Array.isArray(apiCard.tags)
      ? apiCard.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 6)
      : [],
    difficulty: apiCard.difficulty,
    sources: [normalizeSource(document, apiCard)],
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

function userMessageForStatus(status: number, fallback?: string) {
  if (status === 401) return "Sua sessão expirou. Entre novamente e tente gerar os cards.";
  if (status === 413) return "Este material ficou grande demais para esta primeira integração com IA. Tente um documento menor enquanto preparamos o processamento em blocos.";
  if (status === 429) return "O limite gratuito da IA foi atingido agora. Aguarde um pouco e tente novamente.";
  if (status === 503) return "A IA ainda não está configurada na Netlify. Confira a variável GEMINI_API_KEY e publique novamente.";
  if (status >= 500) return "A IA não conseguiu concluir a geração agora. Tente novamente em alguns instantes.";
  return fallback || "Não foi possível gerar os flashcards.";
}

export async function generateFlashcardsFromDocument({
  user,
  deck,
  document,
  options,
}: {
  user: User;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
}): Promise<{ cards: Flashcard[]; meta: GenerationMeta }> {
  if (document.characterCount > MAX_DOCUMENT_CHARACTERS) {
    throw new AIGenerationError(
      "Este documento tem mais de 120 mil caracteres. Nesta primeira integração, use um material menor; o processamento de documentos longos em blocos entra na próxima evolução.",
      "document_too_large",
    );
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/.netlify/functions/generate-flashcards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      deck: {
        id: deck.id,
        title: deck.title,
        specialty: deck.specialty,
        topic: deck.topic || "",
      },
      document: {
        id: document.documentId,
        name: document.name,
        extension: document.extension,
        pages: document.extension === "pdf"
          ? document.pages
              .filter((page) => page.text.trim())
              .map((page) => ({ pageNumber: page.pageNumber, text: page.text }))
          : [{ pageNumber: 0, text: document.fullText }],
      },
      options,
    }),
  });

  let payload: Partial<ApiResponse> & { error?: string; code?: string } = {};
  try {
    payload = await response.json();
  } catch {
    // Resposta sem JSON: o status HTTP ainda será convertido para mensagem amigável.
  }

  if (!response.ok) {
    throw new AIGenerationError(
      userMessageForStatus(response.status, payload.error),
      payload.code || `http_${response.status}`,
    );
  }

  if (!Array.isArray(payload.cards) || !payload.generatedAt || !payload.model || payload.provider !== "gemini") {
    throw new AIGenerationError(
      "A IA respondeu em um formato inesperado. Tente novamente.",
      "invalid_ai_response",
    );
  }

  const cards = payload.cards
    .filter((card): card is ApiCard => Boolean(card?.question?.trim() && card?.answer?.trim()))
    .map((card) => mapCard(deck, document, card, payload.generatedAt as string));

  if (cards.length === 0) {
    throw new AIGenerationError(
      "A IA não encontrou conteúdo suficiente no material para criar cards confiáveis com essas configurações.",
      "no_cards",
    );
  }

  return {
    cards,
    meta: {
      provider: "gemini",
      model: payload.model,
      requestedCount: options.cardCount,
      returnedCount: cards.length,
      generatedAt: payload.generatedAt,
      documentName: document.name,
    },
  };
}
