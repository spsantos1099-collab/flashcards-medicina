import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import type { Flashcard } from "../types";

function sortCards(cards: Flashcard[]) {
  return [...cards].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime;
  });
}

export function useCards(uid?: string, deckId?: string) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(Boolean(uid && deckId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !deckId) {
      setCards([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const cardsRef = ref(database, `cards/${uid}`);
    const unsubscribe = onValue(
      cardsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCards([]);
          setLoading(false);
          return;
        }
        const raw = snapshot.val() as Record<string, Omit<Flashcard, "id"> & { id?: string }>;
        const parsed = Object.entries(raw)
          .map(([key, value]) => ({ ...value, id: value.id || key } as Flashcard))
          .filter((card) => card.deckId === deckId);
        setCards(sortCards(parsed));
        setLoading(false);
        setError(null);
      },
      () => {
        setError("Não foi possível carregar os cards deste deck agora.");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [uid, deckId]);

  const counts = useMemo(() => ({
    basic: cards.filter((card) => card.type === "basic").length,
    cloze: cards.filter((card) => card.type === "cloze").length,
    clinical_case: cards.filter((card) => card.type === "clinical_case").length,
  }), [cards]);

  return { cards, loading, error, counts };
}
