import type { User } from "firebase/auth";
import { get, ref, set, update } from "firebase/database";
import { database } from "./firebase";
import type { UserProfile } from "../types";

export type UserDataCollection =
  | "decks"
  | "cards"
  | "reviews"
  | "studySessions"
  | "documents";

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
