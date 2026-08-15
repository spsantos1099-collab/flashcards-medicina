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
const ATOMIC_SLICE_CHARACTERS = 6_000;
const TARGET_BATCH_CHARACTERS = 14_000;
const MAX_CARDS_PER_BATCH = 4;

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

interface SourceSlice {
  pageNumber: number;
  text: string;
}

interface GenerationBatch {
  pages: SourceSlice[];
  cardCount: number;
}

export interface GenerationProgress {
  completedBatches: number;
  totalBatches: number;
  generatedCards: number;
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
  if (status === 413) return "Um trecho ficou grande demais para a IA. O Fichário tentou dividir o documento, mas não conseguiu concluir este lote.";
  if (status === 429) return "O limite gratuito da IA foi atingido agora. Aguarde um pouco e tente novamente.";
  if (status === 504) return "A IA demorou demais para responder a um dos trechos. Tente novamente; o documento já está sendo processado em lotes menores.";
  if (status === 503) return "A IA ainda não está configurada na Netlify. Confira a variável GEMINI_API_KEY e publique novamente.";
  if (status >= 500) return "A IA não conseguiu concluir um dos lotes agora. Tente novamente em alguns instantes.";
  return fallback || "Não foi possível gerar os flashcards.";
}

function splitLongText(text: string, maxCharacters: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxCharacters) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const pieces: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) pieces.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs.length ? paragraphs : [normalized]) {
    if (paragraph.length > maxCharacters) {
      pushCurrent();
      for (let start = 0; start < paragraph.length; start += maxCharacters) {
        pieces.push(paragraph.slice(start, start + maxCharacters).trim());
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxCharacters) {
      pushCurrent();
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  pushCurrent();
  return pieces.filter(Boolean);
}

function makeSourceSlices(document: ExtractedDocument): SourceSlice[] {
  if (document.extension === "pdf") {
    return document.pages
      .filter((page) => page.text.trim())
      .flatMap((page) =>
        splitLongText(page.text, ATOMIC_SLICE_CHARACTERS).map((text) => ({
          pageNumber: page.pageNumber,
          text,
        })),
      );
  }

  return splitLongText(document.fullText, ATOMIC_SLICE_CHARACTERS).map((text) => ({
    pageNumber: 0,
    text,
  }));
}

function selectEvenly<T>(items: T[], count: number): T[] {
  if (count >= items.length) return items;
  if (count <= 1) return [items[Math.floor(items.length / 2)]];

  const selected: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (items.length - 1)) / (count - 1));
    if (!used.has(index)) {
      selected.push(items[index]);
      used.add(index);
    }
  }
  return selected;
}

function partitionSlices(slices: SourceSlice[], desiredBatches: number): SourceSlice[][] {
  if (desiredBatches <= 1 || slices.length <= 1) return [slices];

  const totalCharacters = slices.reduce((sum, slice) => sum + slice.text.length, 0);
  const groups: SourceSlice[][] = [];
  let current: SourceSlice[] = [];
  let currentCharacters = 0;
  let consumedCharacters = 0;

  slices.forEach((slice, index) => {
    current.push(slice);
    currentCharacters += slice.text.length;
    consumedCharacters += slice.text.length;

    const groupsStillNeeded = desiredBatches - groups.length - 1;
    const slicesStillAvailable = slices.length - index - 1;
    if (groupsStillNeeded <= 0 || slicesStillAvailable < groupsStillNeeded) return;

    const nextBoundary = (totalCharacters * (groups.length + 1)) / desiredBatches;
    if (consumedCharacters >= nextBoundary || currentCharacters >= TARGET_BATCH_CHARACTERS) {
      groups.push(current);
      current = [];
      currentCharacters = 0;
    }
  });

  if (current.length) groups.push(current);
  return groups;
}

function buildBatches(document: ExtractedDocument, requestedCards: number): GenerationBatch[] {
  const slices = makeSourceSlices(document);
  if (slices.length === 0) return [];

  const totalCharacters = slices.reduce((sum, slice) => sum + slice.text.length, 0);
  const batchesForCards = Math.ceil(requestedCards / MAX_CARDS_PER_BATCH);
  const batchesForSize = Math.ceil(totalCharacters / TARGET_BATCH_CHARACTERS);
  const desiredBatches = Math.max(1, batchesForCards, batchesForSize);

  let groups = partitionSlices(slices, Math.min(desiredBatches, slices.length));

  // Se o documento for muito grande para a quantidade pedida de cards, usamos
  // trechos distribuídos ao longo do material em vez de concentrar tudo no início.
  if (groups.length > requestedCards) {
    groups = selectEvenly(groups, Math.max(1, requestedCards));
  }

  const baseCount = Math.floor(requestedCards / groups.length);
  let remainder = requestedCards % groups.length;

  return groups.map((pages) => {
    const cardCount = Math.min(
      MAX_CARDS_PER_BATCH,
      Math.max(1, baseCount + (remainder-- > 0 ? 1 : 0)),
    );
    return { pages, cardCount };
  });
}

function normalizeQuestion(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

async function requestBatch({
  idToken,
  deck,
  document,
  options,
  batch,
}: {
  idToken: string;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
  batch: GenerationBatch;
}): Promise<ApiResponse> {
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
        pages: batch.pages,
      },
      options: {
        ...options,
        cardCount: batch.cardCount,
      },
    }),
  });

  let payload: Partial<ApiResponse> & { error?: string; code?: string } = {};
  try {
    payload = await response.json();
  } catch {
    // O status HTTP ainda será convertido para uma mensagem amigável.
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

  return payload as ApiResponse;
}

export async function generateFlashcardsFromDocument({
  user,
  deck,
  document,
  options,
  onProgress,
}: {
  user: User;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
  onProgress?: (progress: GenerationProgress) => void;
}): Promise<{ cards: Flashcard[]; meta: GenerationMeta }> {
  if (document.characterCount > MAX_DOCUMENT_CHARACTERS) {
    throw new AIGenerationError(
      "Este documento tem mais de 120 mil caracteres. Nesta primeira integração, use um material menor; a expansão para documentos ainda maiores entra depois.",
      "document_too_large",
    );
  }

  const batches = buildBatches(document, options.cardCount);
  if (batches.length === 0) {
    throw new AIGenerationError(
      "Não há texto extraído suficiente para enviar à IA.",
      "empty_document",
    );
  }

  const idToken = await user.getIdToken();
  const collectedCards: Flashcard[] = [];
  const seenQuestions = new Set<string>();
  let model = "";
  let generatedAt = new Date().toISOString();

  onProgress?.({ completedBatches: 0, totalBatches: batches.length, generatedCards: 0 });

  for (let index = 0; index < batches.length; index += 1) {
    const payload = await requestBatch({
      idToken,
      deck,
      document,
      options,
      batch: batches[index],
    });

    model = payload.model;
    generatedAt = payload.generatedAt;

    for (const apiCard of payload.cards) {
      if (!apiCard?.question?.trim() || !apiCard?.answer?.trim()) continue;
      const key = normalizeQuestion(apiCard.question);
      if (!key || seenQuestions.has(key)) continue;
      seenQuestions.add(key);
      collectedCards.push(mapCard(deck, document, apiCard, payload.generatedAt));
    }

    onProgress?.({
      completedBatches: index + 1,
      totalBatches: batches.length,
      generatedCards: collectedCards.length,
    });
  }

  const cards = collectedCards.slice(0, options.cardCount);
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
      model: model || "gemini",
      requestedCount: options.cardCount,
      returnedCount: cards.length,
      generatedAt,
      documentName: document.name,
    },
  };
}
