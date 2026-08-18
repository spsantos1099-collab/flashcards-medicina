import type { User } from "firebase/auth";
import { get, push, ref, set, update } from "firebase/database";
import { database } from "./firebase";
import { scheduleReview } from "./spacedRepetition";
import type { CardType, CreationMode, Deck, Difficulty, DocumentRecord, ExtractedDocument, ExtractionIssue, Flashcard, ReviewRating, ReviewRecord, StudySessionRecord, UserProfile } from "../types";

export type UserDataCollection =
  | "decks"
  | "cards"
  | "reviews"
  | "studySessions"
  | "documents";

export interface CreateDeckInput {
  title: string;
  specialty: string;
  topic?: string;
}

export interface UpdateDeckInput {
  title: string;
  specialty: string;
  topic?: string;
}

export interface UpdateCardInput {
  type: CardType;
  difficulty: Difficulty;
  topic: string;
  question: string;
  answer: string;
  explanation?: string;
  tags: string[];
}

export interface UpdateUserProfileInput {
  name: string;
  course: string;
}

function isoNow() {
  return new Date().toISOString();
}

function fallbackName(user: User) {
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email) return user.email.split("@")[0];
  return "Estudante";
}

/**
 * Cria o perfil do usuário no Realtime Database quando ele ainda não existe.
 * Para contas criadas antes da Fase 3, esta função faz a migração automática
 * no próximo login/carregamento da sessão.
 */
export async function ensureUserProfile(
  user: User,
  preferredName?: string,
): Promise<UserProfile> {
  const userRef = ref(database, `users/${user.uid}`);
  const snapshot = await get(userRef);
  const now = isoNow();
  const name = preferredName?.trim() || fallbackName(user);
  const email = user.email ?? "";

  if (!snapshot.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      name,
      email,
      course: "Medicina",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };

    await set(userRef, profile);
    return profile;
  }

  const current = snapshot.val() as Partial<UserProfile>;
  const updates: Partial<UserProfile> = {
    uid: user.uid,
    email,
    course: current.course?.trim() || "Medicina",
    updatedAt: now,
    lastLoginAt: now,
  };

  // Nunca troca um nome já salvo por um fallback pior. No cadastro, o nome
  // digitado explicitamente tem prioridade e atualiza o perfil.
  if (preferredName?.trim()) {
    updates.name = preferredName.trim();
  } else if (!current.name) {
    updates.name = name;
  }

  await update(userRef, updates);

  return {
    uid: user.uid,
    name: updates.name ?? current.name ?? name,
    email,
    course: updates.course ?? current.course ?? "Medicina",
    createdAt: current.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: now,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await get(ref(database, `users/${uid}`));
  return snapshot.exists() ? (snapshot.val() as UserProfile) : null;
}

/** Atualiza os dados pessoais editáveis do perfil. */
export async function updateUserProfileData(
  uid: string,
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
  const userRef = ref(database, `users/${uid}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) throw new Error("Perfil não encontrado.");

  const current = snapshot.val() as UserProfile;
  const now = isoNow();
  const name = input.name.trim();
  const course = input.course.trim();

  if (!name) throw new Error("Informe seu nome.");
  if (!course) throw new Error("Informe seu curso.");

  const updates: Partial<UserProfile> = {
    name,
    course,
    updatedAt: now,
  };

  await update(userRef, updates);

  return {
    ...current,
    name,
    course,
    updatedAt: now,
  };
}

/**
 * Referência padronizada para os dados privados do usuário.
 * Ex.: userCollectionRef("decks", uid) => decks/{uid}
 */
export function userCollectionRef(collection: UserDataCollection, uid: string) {
  return ref(database, `${collection}/${uid}`);
}

/** Cria um deck vazio real no Realtime Database. */
export async function createDeck(uid: string, input: CreateDeckInput): Promise<Deck> {
  const collectionRef = userCollectionRef("decks", uid);
  const newDeckRef = push(collectionRef);
  const id = newDeckRef.key;

  if (!id) throw new Error("Não foi possível criar o identificador do deck.");

  const now = isoNow();
  const deck: Deck = {
    id,
    title: input.title.trim(),
    specialty: input.specialty.trim(),
    creationMode: "manual",
    totalCards: 0,
    dueToday: 0,
    newCards: 0,
    learnedCards: 0,
    createdAt: now,
    updatedAt: now,
  };

  const topic = input.topic?.trim();
  if (topic) deck.topic = topic;

  await set(newDeckRef, deck);
  return deck;
}

/** Edita apenas os metadados que o usuário pode alterar nesta fase. */
export async function updateDeckData(
  uid: string,
  deckId: string,
  input: UpdateDeckInput,
): Promise<void> {
  const updates: Record<string, string | null> = {
    title: input.title.trim(),
    specialty: input.specialty.trim(),
    topic: input.topic?.trim() || null,
    updatedAt: isoNow(),
  };

  await update(ref(database, `decks/${uid}/${deckId}`), updates);
}

/** Exclui o deck e os cards associados para não deixar registros órfãos. */
export async function deleteDeck(uid: string, deckId: string): Promise<void> {
  const [cardsSnapshot, documentsSnapshot, reviewsSnapshot, sessionsSnapshot] = await Promise.all([
    get(ref(database, `cards/${uid}`)),
    get(ref(database, `documents/${uid}`)),
    get(ref(database, `reviews/${uid}`)),
    get(ref(database, `studySessions/${uid}`)),
  ]);
  const updates: Record<string, null> = {
    [`decks/${uid}/${deckId}`]: null,
  };

  if (cardsSnapshot.exists()) {
    const raw = cardsSnapshot.val() as Record<string, Partial<Flashcard>>;
    Object.entries(raw).forEach(([cardId, card]) => {
      if (card.deckId === deckId) updates[`cards/${uid}/${cardId}`] = null;
    });
  }

  if (documentsSnapshot.exists()) {
    const raw = documentsSnapshot.val() as Record<string, Partial<DocumentRecord>>;
    Object.entries(raw).forEach(([documentId, document]) => {
      if (document.deckId === deckId) updates[`documents/${uid}/${documentId}`] = null;
    });
  }

  if (reviewsSnapshot.exists()) {
    const raw = reviewsSnapshot.val() as Record<string, Partial<ReviewRecord>>;
    Object.entries(raw).forEach(([reviewId, review]) => {
      if (review.deckId === deckId) updates[`reviews/${uid}/${reviewId}`] = null;
    });
  }

  if (sessionsSnapshot.exists()) {
    const raw = sessionsSnapshot.val() as Record<string, Partial<StudySessionRecord>>;
    Object.entries(raw).forEach(([sessionId, session]) => {
      if (session.deckId === deckId) updates[`studySessions/${uid}/${sessionId}`] = null;
    });
  }

  await update(ref(database), updates);
}


/** Registra somente os metadados do PDF/DOCX. O arquivo em si nunca vai para o Firebase. */
export async function createDocumentRecord(
  uid: string,
  deckId: string,
  file: File,
): Promise<DocumentRecord> {
  const collectionRef = userCollectionRef("documents", uid);
  const newDocumentRef = push(collectionRef);
  const id = newDocumentRef.key;

  if (!id) throw new Error("Não foi possível criar o identificador do documento.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "pdf" && extension !== "docx") {
    throw new Error("Formato de documento não suportado.");
  }

  const now = isoNow();
  const record: DocumentRecord = {
    id,
    deckId,
    name: file.name,
    extension,
    mimeType: file.type || (extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    sizeBytes: file.size,
    extractionStatus: "pending",
    storageMode: "browser_only",
    extractedTextStored: false,
    createdAt: now,
    updatedAt: now,
  };

  await set(newDocumentRef, record);
  return record;
}

/** Liga o documento ao deck sem guardar bytes ou URL de arquivo. */
export async function linkDocumentToDeck(
  uid: string,
  deckId: string,
  document: DocumentRecord,
  creationMode: CreationMode = "upload",
): Promise<void> {
  await update(ref(database, `decks/${uid}/${deckId}`), {
    creationMode,
    sourceDocumentId: document.id,
    sourceDocumentName: document.name,
    updatedAt: isoNow(),
  });
}

/** Marca o início da extração local sem salvar nenhum conteúdo do documento. */
export async function markDocumentExtractionProcessing(
  uid: string,
  documentId: string,
): Promise<void> {
  await update(ref(database, `documents/${uid}/${documentId}`), {
    extractionStatus: "processing",
    extractionIssue: null,
    updatedAt: isoNow(),
  });
}

/**
 * Salva apenas métricas da extração. O texto e as páginas continuam somente
 * na memória do navegador e nunca são gravados no Realtime Database.
 */
export async function markDocumentExtractionReady(
  uid: string,
  documentId: string,
  extracted: ExtractedDocument,
): Promise<void> {
  await update(ref(database, `documents/${uid}/${documentId}`), {
    extractionStatus: "ready",
    extractionIssue: null,
    pageCount: extracted.pageCount ?? null,
    pagesWithText: extracted.pagesWithText ?? null,
    characterCount: extracted.characterCount,
    wordCount: extracted.wordCount,
    warningCount: extracted.warnings.length,
    extractedAt: extracted.extractedAt,
    extractedTextStored: false,
    updatedAt: isoNow(),
  });
}

/** Registra somente o tipo da falha, sem conteúdo do arquivo nem mensagem técnica. */
export async function markDocumentExtractionError(
  uid: string,
  documentId: string,
  issue: ExtractionIssue,
): Promise<void> {
  await update(ref(database, `documents/${uid}/${documentId}`), {
    extractionStatus: "error",
    extractionIssue: issue,
    extractedTextStored: false,
    updatedAt: isoNow(),
  });
}



function firebaseSafe<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => firebaseSafe(item)) as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item !== undefined) result[key] = firebaseSafe(item);
    });
    return result as T;
  }
  return value;
}

/**
 * Persiste os cards aprovados e atualiza os contadores do deck em uma única
 * atualização multi-local do Realtime Database.
 */
export async function saveCardsToDeck(
  uid: string,
  deckId: string,
  cards: Flashcard[],
): Promise<number> {
  if (!cards.length) return 0;

  const deckRef = ref(database, `decks/${uid}/${deckId}`);
  const deckSnapshot = await get(deckRef);
  if (!deckSnapshot.exists()) throw new Error("Deck não encontrado.");
  const deck = deckSnapshot.val() as Deck;
  const now = isoNow();

  const updates: Record<string, unknown> = {};
  for (const card of cards) {
    const stored: Flashcard = {
      ...card,
      deckId,
      createdAt: card.createdAt || now,
      updatedAt: now,
    };
    updates[`cards/${uid}/${card.id}`] = firebaseSafe(stored);
  }

  updates[`decks/${uid}/${deckId}/totalCards`] = (deck.totalCards || 0) + cards.length;
  updates[`decks/${uid}/${deckId}/newCards`] = (deck.newCards || 0) + cards.length;
  updates[`decks/${uid}/${deckId}/updatedAt`] = now;

  await update(ref(database), updates);
  return cards.length;
}


/** Edita o conteúdo de um card já salvo, preservando fonte e histórico de estudo. */
export async function updateCardData(
  uid: string,
  cardId: string,
  input: UpdateCardInput,
): Promise<void> {
  await update(ref(database, `cards/${uid}/${cardId}`), {
    type: input.type,
    difficulty: input.difficulty,
    topic: input.topic.trim(),
    question: input.question.trim(),
    answer: input.answer.trim(),
    explanation: input.explanation?.trim() || null,
    tags: input.tags,
    updatedAt: isoNow(),
  });
}

/**
 * Exclui um ou vários cards salvos e remove também os reviews associados.
 * Os contadores persistidos do deck são recalculados a partir do estado real restante.
 */
export async function deleteCards(
  uid: string,
  deckId: string,
  cardIds: string[],
): Promise<number> {
  const uniqueIds = Array.from(new Set(cardIds.filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  const [cardsSnapshot, reviewsSnapshot, deckSnapshot] = await Promise.all([
    get(ref(database, `cards/${uid}`)),
    get(ref(database, `reviews/${uid}`)),
    get(ref(database, `decks/${uid}/${deckId}`)),
  ]);

  if (!deckSnapshot.exists()) throw new Error("Deck não encontrado.");

  const rawCards = cardsSnapshot.exists()
    ? cardsSnapshot.val() as Record<string, Omit<Flashcard, "id"> & { id?: string }>
    : {};
  const requested = new Set(uniqueIds);
  const validIds = new Set(
    Object.entries(rawCards)
      .filter(([cardId, card]) => requested.has(cardId) && card.deckId === deckId)
      .map(([cardId]) => cardId),
  );

  if (validIds.size === 0) return 0;

  const updates: Record<string, unknown> = {};
  validIds.forEach((cardId) => {
    updates[`cards/${uid}/${cardId}`] = null;
  });

  const remainingReviewCardIds = new Set<string>();
  if (reviewsSnapshot.exists()) {
    const rawReviews = reviewsSnapshot.val() as Record<string, Omit<ReviewRecord, "id"> & { id?: string }>;
    Object.entries(rawReviews).forEach(([reviewId, review]) => {
      if (validIds.has(review.cardId)) {
        updates[`reviews/${uid}/${reviewId}`] = null;
      } else if (review.deckId === deckId) {
        remainingReviewCardIds.add(review.cardId);
      }
    });
  }

  const remainingDeckCards = Object.entries(rawCards)
    .filter(([cardId, card]) => card.deckId === deckId && !validIds.has(cardId))
    .map(([cardId, card]) => ({ ...card, id: card.id || cardId } as Flashcard));
  const newCards = remainingDeckCards.filter((card) => !remainingReviewCardIds.has(card.id)).length;

  updates[`decks/${uid}/${deckId}/totalCards`] = remainingDeckCards.length;
  updates[`decks/${uid}/${deckId}/newCards`] = newCards;
  updates[`decks/${uid}/${deckId}/learnedCards`] = Math.max(0, remainingDeckCards.length - newCards);
  updates[`decks/${uid}/${deckId}/updatedAt`] = isoNow();

  await update(ref(database), updates);
  return validIds.size;
}

/** Marca ou desmarca um card como favorito. */
export async function setCardFavorite(
  uid: string,
  cardId: string,
  isFavorite: boolean,
): Promise<void> {
  await update(ref(database, `cards/${uid}/${cardId}`), {
    isFavorite,
    updatedAt: isoNow(),
  });
}

/** Inicia uma sessão real de estudo para um deck. */
export async function createStudySession(uid: string, deckId: string): Promise<StudySessionRecord> {
  const sessionRef = push(ref(database, `studySessions/${uid}`));
  const id = sessionRef.key;
  if (!id) throw new Error("Não foi possível iniciar a sessão de estudo.");

  const session: StudySessionRecord = {
    id,
    deckId,
    startedAt: isoNow(),
    reviewedCards: 0,
  };
  await set(sessionRef, session);
  return session;
}

/** Atualiza o progresso da sessão; ao concluir, grava endedAt. */
export async function updateStudySessionProgress(
  uid: string,
  sessionId: string,
  reviewedCards: number,
  completed = false,
): Promise<void> {
  await update(ref(database, `studySessions/${uid}/${sessionId}`), {
    reviewedCards,
    endedAt: completed ? isoNow() : null,
  });
}

/**
 * Persiste a avaliação, aplica o FSRS e grava a próxima revisão do card.
 * Na primeira avaliação daquele card, também move 1 unidade de Novos para Aprendidos.
 */
export async function recordStudyRating(
  uid: string,
  deckId: string,
  card: Flashcard,
  rating: ReviewRating,
): Promise<ReviewRecord> {
  const [deckSnapshot, reviewsSnapshot] = await Promise.all([
    get(ref(database, `decks/${uid}/${deckId}`)),
    get(ref(database, `reviews/${uid}`)),
  ]);

  if (!deckSnapshot.exists()) throw new Error("Deck não encontrado.");
  const deck = deckSnapshot.val() as Deck;
  const now = isoNow();
  const reviewRef = push(ref(database, `reviews/${uid}`));
  const id = reviewRef.key;
  if (!id) throw new Error("Não foi possível registrar a avaliação.");

  let previousReviews: ReviewRecord[] = [];
  if (reviewsSnapshot.exists()) {
    const raw = reviewsSnapshot.val() as Record<string, Omit<ReviewRecord, "id"> & { id?: string }>;
    previousReviews = Object.entries(raw)
      .map(([key, value]) => ({ ...value, id: value.id || key }))
      .filter((review) => review.cardId === card.id && review.deckId === deckId);
  }

  const scheduling = scheduleReview(card, previousReviews, rating, new Date(now));
  const review: ReviewRecord = {
    id,
    cardId: card.id,
    deckId,
    rating,
    reviewedAt: now,
    nextReviewAt: scheduling.nextReviewAt,
    scheduledDays: scheduling.scheduledDays,
    stability: scheduling.stability,
    memoryDifficulty: scheduling.memoryDifficulty,
    schedulerState: scheduling.schedulerState,
  };

  const updates: Record<string, unknown> = {
    [`reviews/${uid}/${id}`]: review,
    [`cards/${uid}/${card.id}/srs`]: scheduling.nextState,
    [`cards/${uid}/${card.id}/updatedAt`]: now,
    [`decks/${uid}/${deckId}/updatedAt`]: now,
  };

  if (previousReviews.length === 0) {
    updates[`decks/${uid}/${deckId}/newCards`] = Math.max(0, (deck.newCards || 0) - 1);
    updates[`decks/${uid}/${deckId}/learnedCards`] = (deck.learnedCards || 0) + 1;
  }

  await update(ref(database), updates);
  return review;
}

