import type { User } from "firebase/auth";
import { get, push, ref, remove, set, update } from "firebase/database";
import { database } from "./firebase";
import type { Deck, DocumentRecord, UserProfile } from "../types";

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
    course: "Medicina",
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
    course: "Medicina",
    createdAt: current.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: now,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await get(ref(database, `users/${uid}`));
  return snapshot.exists() ? (snapshot.val() as UserProfile) : null;
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

/** Exclui o deck. Cards ainda não existem de forma persistida nesta fase. */
export async function deleteDeck(uid: string, deckId: string): Promise<void> {
  await remove(ref(database, `decks/${uid}/${deckId}`));
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
): Promise<void> {
  await update(ref(database, `decks/${uid}/${deckId}`), {
    creationMode: "upload",
    sourceDocumentId: document.id,
    sourceDocumentName: document.name,
    updatedAt: isoNow(),
  });
}
