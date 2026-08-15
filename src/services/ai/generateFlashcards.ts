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
const ATOMIC_SLICE_CHARACTERS = 5_500;
const FAST_BATCH_CHARACTERS = 12_000;
const CLINICAL_BATCH_CHARACTERS = 8_500;
const MAX_FAST_CARDS_PER_BATCH = 4;
const MAX_CLINICAL_CARDS_PER_BATCH = 4;
const MAX_REFILL_ROUNDS = 3;
const MAX_EXCLUDED_QUESTIONS = 40;
const MAX_EXCLUDED_OBJECTIVES = 40;
const MAX_REQUEST_ATTEMPTS = 3;
const BETWEEN_CALLS_MS = 350;

interface ApiEvidence {
  sourcePage: number;
  sourceExcerpt: string;
}

interface ApiCard {
  type: CardType;
  learningObjective: string;
  question: string;
  answer: string;
  explanation: string;
  topic: string;
  tags: string[];
  difficulty: Difficulty;
  evidences: ApiEvidence[];
}

interface ApiResponse {
  provider: "gemini";
  model: string;
  cards: ApiCard[];
  generatedAt: string;
  rejected?: Array<{ index: number; reason?: string }>;
}

interface ErrorPayload {
  error?: string;
  code?: string;
  transient?: boolean;
  retryAfterMs?: number;
  providerStatus?: number;
}

interface SourceSlice {
  pageNumber: number;
  text: string;
}

interface GenerationBatch {
  pages: SourceSlice[];
  cardCount: number;
  cardType: CardType;
}

export interface GenerationProgress {
  completedBatches: number;
  totalBatches: number;
  generatedCards: number;
  targetCards: number;
  stage: "generating" | "validating" | "refill" | "retrying";
  currentType?: CardType;
  refillRound?: number;
  retryAttempt?: number;
}

export class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly transient = false,
    public readonly retryAfterMs?: number,
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeSource(document: ExtractedDocument, evidence: ApiEvidence): CardSource {
  const page = document.extension === "pdf" && evidence.sourcePage > 0
    ? evidence.sourcePage
    : undefined;

  return {
    id: temporaryId("source"),
    kind: "upload",
    title: document.name,
    documentId: document.documentId,
    page,
    excerpt: evidence.sourceExcerpt.trim(),
    verificationStatus: "user_material",
  };
}

function cleanClozeAnswer(answer: string, question: string) {
  const values = [...question.matchAll(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  if (/\{\{c\d+::/.test(answer) || normalizeText(answer) === normalizeText(question)) {
    return values.length ? values.join("; ") : answer.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, "$1").trim();
  }
  return answer.trim();
}

function mapCard(
  deck: Deck,
  document: ExtractedDocument,
  apiCard: ApiCard,
  generatedAt: string,
): Flashcard {
  const evidences = Array.isArray(apiCard.evidences) ? apiCard.evidences : [];
  return {
    id: temporaryId("generated"),
    deckId: deck.id,
    type: apiCard.type,
    learningObjective: apiCard.learningObjective?.trim() || undefined,
    question: apiCard.question.trim(),
    answer: apiCard.type === "cloze"
      ? cleanClozeAnswer(apiCard.answer, apiCard.question)
      : apiCard.answer.trim(),
    explanation: apiCard.explanation.trim() || undefined,
    topic: apiCard.topic.trim() || deck.topic || deck.title,
    tags: Array.isArray(apiCard.tags)
      ? apiCard.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 6)
      : [],
    difficulty: apiCard.difficulty,
    sources: evidences.map((evidence) => normalizeSource(document, evidence)),
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

function userMessageForStatus(status: number, fallback?: string) {
  if (status === 401) return "Sua sessão expirou. Entre novamente e tente gerar os cards.";
  if (status === 413) return "Um trecho ficou grande demais para a IA. O Fichário não conseguiu dividir esse trecho corretamente.";
  if (status === 403 || status === 400) return fallback || "A configuração da IA recusou esta solicitação.";
  if (status === 503) return fallback || "A IA ainda não está configurada na Netlify.";
  return fallback || "A IA ficou temporariamente indisponível.";
}

function isTransientHttpStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
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

function partitionSlices(slices: SourceSlice[], desiredBatches: number, targetCharacters: number): SourceSlice[][] {
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
    if (consumedCharacters >= nextBoundary || currentCharacters >= targetCharacters) {
      groups.push(current);
      current = [];
      currentCharacters = 0;
    }
  });

  if (current.length) groups.push(current);
  return groups;
}

function maxCardsPerBatch(type: CardType) {
  return type === "clinical_case" ? MAX_CLINICAL_CARDS_PER_BATCH : MAX_FAST_CARDS_PER_BATCH;
}

function targetBatchCharacters(type: CardType) {
  return type === "clinical_case" ? CLINICAL_BATCH_CHARACTERS : FAST_BATCH_CHARACTERS;
}

function buildBatches(document: ExtractedDocument, requestedCards: number, cardType: CardType): GenerationBatch[] {
  const slices = makeSourceSlices(document);
  if (slices.length === 0) return [];

  const totalCharacters = slices.reduce((sum, slice) => sum + slice.text.length, 0);
  const maxCards = maxCardsPerBatch(cardType);
  const targetCharacters = targetBatchCharacters(cardType);
  const batchesForCards = Math.ceil(requestedCards / maxCards);
  const batchesForSize = Math.ceil(totalCharacters / targetCharacters);
  const desiredBatches = Math.max(1, batchesForCards, batchesForSize);

  let groups = partitionSlices(slices, Math.min(desiredBatches, slices.length), targetCharacters);
  if (groups.length > requestedCards) groups = selectEvenly(groups, Math.max(1, requestedCards));

  const baseCount = Math.floor(requestedCards / groups.length);
  let remainder = requestedCards % groups.length;

  return groups.map((pages) => ({
    pages,
    cardType,
    cardCount: Math.min(maxCards, Math.max(1, baseCount + (remainder-- > 0 ? 1 : 0))),
  }));
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return items;
  const normalized = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function buildRefillBatch(
  document: ExtractedDocument,
  remainingCards: number,
  currentCards: Flashcard[],
  cardType: CardType,
  round: number,
): GenerationBatch | null {
  const slices = makeSourceSlices(document);
  if (slices.length === 0 || remainingCards <= 0) return null;

  const pageCoverage = new Map<number, number>();
  for (const card of currentCards) {
    const page = card.sources[0]?.page ?? 0;
    pageCoverage.set(page, (pageCoverage.get(page) ?? 0) + 1);
  }

  let rankedSlices = [...slices].sort((a, b) => {
    const coverageA = pageCoverage.get(a.pageNumber) ?? 0;
    const coverageB = pageCoverage.get(b.pageNumber) ?? 0;
    if (coverageA !== coverageB) return coverageA - coverageB;
    return a.pageNumber - b.pageNumber;
  });
  rankedSlices = rotate(rankedSlices, (round - 1) * Math.max(1, Math.floor(rankedSlices.length / 3)));

  const selected: SourceSlice[] = [];
  const maxCharacters = targetBatchCharacters(cardType);
  let characters = 0;
  const selectedPages = new Set<number>();

  for (const slice of rankedSlices) {
    if (characters + slice.text.length > maxCharacters && selected.length > 0) continue;
    selected.push(slice);
    selectedPages.add(slice.pageNumber);
    characters += slice.text.length;
    if (characters >= Math.min(6_500, maxCharacters) && selectedPages.size >= Math.min(3, rankedSlices.length)) break;
    if (characters >= maxCharacters) break;
  }

  if (selected.length === 0) return null;
  return {
    pages: selected,
    cardType,
    cardCount: Math.min(maxCardsPerBatch(cardType), Math.max(2, remainingCards + 1)),
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[²₂]/g, "2")
    .replace(/[³₃]/g, "3")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function textTokens(value: string, minimumLength = 3) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length >= minimumLength));
}

function similarity(a: string, b: string, minimumLength = 3) {
  const tokensA = textTokens(a, minimumLength);
  const tokensB = textTokens(b, minimumLength);
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const token of tokensA) if (tokensB.has(token)) intersection += 1;
  return intersection / new Set([...tokensA, ...tokensB]).size;
}

function sourceFingerprint(card: Flashcard) {
  const source = card.sources[0];
  if (!source) return "";
  return `${source.page ?? 0}:${normalizeText(source.excerpt || "")}`;
}

function apiSourceFingerprint(card: ApiCard) {
  const source = card.evidences?.[0];
  if (!source) return "";
  return `${source.sourcePage ?? 0}:${normalizeText(source.sourceExcerpt || "")}`;
}

function isDuplicateCard(apiCard: ApiCard, currentCards: Flashcard[]) {
  const objective = apiCard.learningObjective || apiCard.question;
  const answer = normalizeText(apiCard.answer);
  const fingerprint = apiSourceFingerprint(apiCard);

  return currentCards.some((card) => {
    const existingObjective = card.learningObjective || card.question;
    if (similarity(objective, existingObjective) >= 0.72) return true;
    if (similarity(apiCard.question, card.question, 4) >= 0.83) return true;
    if (answer && answer === normalizeText(card.answer) && fingerprint && fingerprint === sourceFingerprint(card)
      && similarity(objective, existingObjective) >= 0.45) return true;
    return false;
  });
}

function allocateTypeTargets(types: CardType[], totalCards: number) {
  const unique = Array.from(new Set(types));
  const targets = new Map<CardType, number>();
  if (unique.length === 0) return targets;

  const base = Math.floor(totalCards / unique.length);
  let remainder = totalCards % unique.length;
  unique.forEach((type) => {
    targets.set(type, base + (remainder-- > 0 ? 1 : 0));
  });
  return targets;
}

function countType(cards: Flashcard[], type: CardType) {
  return cards.filter((card) => card.type === type).length;
}

function shouldSkipBatchError(error: unknown) {
  return error instanceof AIGenerationError && error.code === "no_cards";
}

function shouldAbortPipeline(error: unknown) {
  return error instanceof AIGenerationError && !error.transient && error.code !== "no_cards";
}

async function parseResponse(response: Response): Promise<ApiResponse> {
  let payload: Partial<ApiResponse> & ErrorPayload = {};
  try {
    payload = await response.json();
  } catch {
    // O status ainda informa a classe do erro.
  }

  if (!response.ok) {
    const transient = payload.transient ?? isTransientHttpStatus(response.status);
    throw new AIGenerationError(
      userMessageForStatus(response.status, payload.error),
      payload.code || `http_${response.status}`,
      transient,
      payload.retryAfterMs,
    );
  }

  if (!Array.isArray(payload.cards) || !payload.generatedAt || !payload.model || payload.provider !== "gemini") {
    throw new AIGenerationError(
      "A IA respondeu em um formato inesperado.",
      "invalid_ai_response",
      true,
    );
  }

  return payload as ApiResponse;
}

async function postFunction({
  idToken,
  body,
}: {
  idToken: string;
  body: Record<string, unknown>;
}) {
  let response: Response;
  try {
    response = await fetch("/.netlify/functions/generate-flashcards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AIGenerationError(
      "A conexão com a geração foi interrompida temporariamente.",
      "function_network_error",
      true,
    );
  }
  return parseResponse(response);
}

async function withAutomaticRetry<T>({
  operation,
  onRetry,
}: {
  operation: () => Promise<T>;
  onRetry?: (attempt: number) => void;
}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = error instanceof AIGenerationError && error.transient && attempt < MAX_REQUEST_ATTEMPTS;
      if (!canRetry) throw error;

      onRetry?.(attempt + 1);
      const base = 900 * 2 ** (attempt - 1);
      const jitter = Math.round(Math.random() * 450);
      const providerDelay = error.retryAfterMs ?? 0;
      await sleep(Math.min(8_000, Math.max(base + jitter, providerDelay)));
    }
  }

  throw lastError;
}

async function requestGenerationBatch({
  idToken,
  deck,
  document,
  options,
  batch,
  currentCards,
  generationPhase,
  onRetry,
}: {
  idToken: string;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
  batch: GenerationBatch;
  currentCards: Flashcard[];
  generationPhase: "initial" | "refill";
  onRetry?: (attempt: number) => void;
}) {
  return withAutomaticRetry({
    onRetry,
    operation: () => postFunction({
      idToken,
      body: {
        task: "generate",
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
          requestedType: batch.cardType,
          cardTypes: [batch.cardType],
          cardCount: batch.cardCount,
          generationPhase,
          excludedQuestions: currentCards.map((card) => card.question).slice(-MAX_EXCLUDED_QUESTIONS),
          excludedObjectives: currentCards
            .map((card) => card.learningObjective || "")
            .filter(Boolean)
            .slice(-MAX_EXCLUDED_OBJECTIVES),
        },
      },
    }),
  });
}

async function requestClinicalValidation({
  idToken,
  deck,
  document,
  options,
  batch,
  candidates,
  onRetry,
}: {
  idToken: string;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
  batch: GenerationBatch;
  candidates: ApiCard[];
  onRetry?: (attempt: number) => void;
}) {
  return withAutomaticRetry({
    onRetry,
    operation: () => postFunction({
      idToken,
      body: {
        task: "validate_clinical",
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
          requestedType: "clinical_case",
          cardTypes: ["clinical_case"],
          cardCount: candidates.length,
        },
        candidates,
      },
    }),
  });
}

function appendUniqueCards({
  apiCards,
  deck,
  document,
  generatedAt,
  target,
}: {
  apiCards: ApiCard[];
  deck: Deck;
  document: ExtractedDocument;
  generatedAt: string;
  target: Flashcard[];
}) {
  let added = 0;
  for (const apiCard of apiCards) {
    if (!apiCard?.question?.trim() || !apiCard?.answer?.trim() || !apiCard?.learningObjective?.trim()) continue;
    if (isDuplicateCard(apiCard, target)) continue;
    target.push(mapCard(deck, document, apiCard, generatedAt));
    added += 1;
  }
  return added;
}

function progress({
  onProgress,
  completedBatches,
  totalBatches,
  cards,
  targetCards,
  stage,
  currentType,
  refillRound,
  retryAttempt,
}: {
  onProgress?: (progress: GenerationProgress) => void;
  completedBatches: number;
  totalBatches: number;
  cards: Flashcard[];
  targetCards: number;
  stage: GenerationProgress["stage"];
  currentType?: CardType;
  refillRound?: number;
  retryAttempt?: number;
}) {
  onProgress?.({
    completedBatches,
    totalBatches,
    generatedCards: Math.min(cards.length, targetCards),
    targetCards,
    stage,
    currentType,
    refillRound,
    retryAttempt,
  });
}

async function generateAndValidateBatch({
  idToken,
  deck,
  document,
  options,
  batch,
  currentCards,
  generationPhase,
  completedBatches,
  totalBatches,
  targetCards,
  onProgress,
  models,
  refillRound,
}: {
  idToken: string;
  deck: Deck;
  document: ExtractedDocument;
  options: GenerationOptions;
  batch: GenerationBatch;
  currentCards: Flashcard[];
  generationPhase: "initial" | "refill";
  completedBatches: number;
  totalBatches: number;
  targetCards: number;
  onProgress?: (progress: GenerationProgress) => void;
  models: Set<string>;
  refillRound?: number;
}) {
  const stage: GenerationProgress["stage"] = generationPhase === "refill" ? "refill" : "generating";
  progress({ onProgress, completedBatches, totalBatches, cards: currentCards, targetCards, stage, currentType: batch.cardType, refillRound });

  let generated: ApiResponse;
  try {
    generated = await requestGenerationBatch({
      idToken,
      deck,
      document,
      options,
      batch,
      currentCards,
      generationPhase,
      onRetry: (attempt) => progress({
        onProgress,
        completedBatches,
        totalBatches,
        cards: currentCards,
        targetCards,
        stage: "retrying",
        currentType: batch.cardType,
        refillRound,
        retryAttempt: attempt,
      }),
    });
  } catch (error) {
    if (shouldAbortPipeline(error)) throw error;
    if (shouldSkipBatchError(error) || (error instanceof AIGenerationError && error.transient)) return 0;
    throw error;
  }

  models.add(generated.model);
  let acceptedApiCards = generated.cards;

  if (batch.cardType === "clinical_case" && acceptedApiCards.length > 0) {
    progress({ onProgress, completedBatches, totalBatches, cards: currentCards, targetCards, stage: "validating", currentType: batch.cardType, refillRound });
    try {
      const validated = await requestClinicalValidation({
        idToken,
        deck,
        document,
        options,
        batch,
        candidates: acceptedApiCards,
        onRetry: (attempt) => progress({
          onProgress,
          completedBatches,
          totalBatches,
          cards: currentCards,
          targetCards,
          stage: "retrying",
          currentType: batch.cardType,
          refillRound,
          retryAttempt: attempt,
        }),
      });
      models.add(validated.model);
      acceptedApiCards = validated.cards;
    } catch (error) {
      if (shouldAbortPipeline(error)) throw error;
      // Segurança: caso clínico sem segundo revisor não chega à tela.
      return 0;
    }
  }

  const added = appendUniqueCards({
    apiCards: acceptedApiCards,
    deck,
    document,
    generatedAt: generated.generatedAt,
    target: currentCards,
  });
  await sleep(BETWEEN_CALLS_MS);
  return added;
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
      "Este documento tem mais de 120 mil caracteres. Nesta fase, use um material menor; documentos maiores serão suportados depois.",
      "document_too_large",
    );
  }
  if (options.cardTypes.length === 0) {
    throw new AIGenerationError("Selecione pelo menos um tipo de card.", "no_card_type");
  }

  const typeTargets = allocateTypeTargets(options.cardTypes, options.cardCount);
  const initialPlan = options.cardTypes.flatMap((type) => buildBatches(document, typeTargets.get(type) ?? 0, type));
  if (initialPlan.length === 0) {
    throw new AIGenerationError("Não há texto extraído suficiente para enviar à IA.", "empty_document");
  }

  const idToken = await user.getIdToken();
  const collectedCards: Flashcard[] = [];
  const models = new Set<string>();
  let generatedAt = new Date().toISOString();
  let completedBatches = 0;
  const totalBatches = initialPlan.length;

  progress({
    onProgress,
    completedBatches: 0,
    totalBatches,
    cards: collectedCards,
    targetCards: options.cardCount,
    stage: "generating",
    currentType: initialPlan[0]?.cardType,
  });

  for (const batch of initialPlan) {
    await generateAndValidateBatch({
      idToken,
      deck,
      document,
      options,
      batch,
      currentCards: collectedCards,
      generationPhase: "initial",
      completedBatches,
      totalBatches,
      targetCards: options.cardCount,
      onProgress,
      models,
    });
    completedBatches += 1;
    progress({
      onProgress,
      completedBatches,
      totalBatches,
      cards: collectedCards,
      targetCards: options.cardCount,
      stage: "generating",
      currentType: batch.cardType,
    });
  }

  for (let refillRound = 1; refillRound <= MAX_REFILL_ROUNDS && collectedCards.length < options.cardCount; refillRound += 1) {
    let addedThisRound = 0;

    for (const type of options.cardTypes) {
      const targetForType = typeTargets.get(type) ?? 0;
      const missingForType = targetForType - countType(collectedCards, type);
      if (missingForType <= 0) continue;

      const refillBatch = buildRefillBatch(document, missingForType, collectedCards, type, refillRound);
      if (!refillBatch) continue;

      const added = await generateAndValidateBatch({
        idToken,
        deck,
        document,
        options,
        batch: refillBatch,
        currentCards: collectedCards,
        generationPhase: "refill",
        completedBatches: totalBatches,
        totalBatches,
        targetCards: options.cardCount,
        onProgress,
        models,
        refillRound,
      });
      addedThisRound += added;
      generatedAt = new Date().toISOString();
      if (collectedCards.length >= options.cardCount) break;
    }

    if (addedThisRound === 0 && refillRound >= 2) break;
  }

  // Respeita os alvos por tipo e o total solicitado. Se um tipo ficou abaixo por
  // rejeição de qualidade, não preenche com outro formato escondendo o déficit.
  const cards = options.cardTypes.flatMap((type) =>
    collectedCards.filter((card) => card.type === type).slice(0, typeTargets.get(type) ?? 0),
  ).slice(0, options.cardCount);

  if (cards.length === 0) {
    throw new AIGenerationError(
      "A IA ficou instável ou não encontrou cards que passassem pelas verificações. O Fichário já tentou novamente automaticamente.",
      "generation_exhausted",
      false,
    );
  }

  return {
    cards,
    meta: {
      provider: "gemini",
      model: models.size ? Array.from(models).join(" + ") : "gemini-3.5",
      requestedCount: options.cardCount,
      returnedCount: cards.length,
      generatedAt,
      documentName: document.name,
    },
  };
}
