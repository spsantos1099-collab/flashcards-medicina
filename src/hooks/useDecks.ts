import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import type { Deck } from "../types";

function sortDecks(decks: Deck[]) {
  return [...decks].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return bTime - aTime;
  });
}

export function useDecks(uid?: string) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setDecks([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const decksRef = ref(database, `decks/${uid}`);
    const unsubscribe = onValue(
      decksRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDecks([]);
          setLoading(false);
          return;
        }

        const raw = snapshot.val() as Record<string, Omit<Deck, "id"> & { id?: string }>;
        const parsed = Object.entries(raw).map(([key, value]) => ({
          ...value,
          id: value.id || key,
        })) as Deck[];

        setDecks(sortDecks(parsed));
        setLoading(false);
      },
      () => {
        setError("Não foi possível carregar seus decks agora. Tente novamente em instantes.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  const totals = useMemo(
    () => ({
      totalCards: decks.reduce((sum, deck) => sum + (deck.totalCards || 0), 0),
      dueToday: decks.reduce((sum, deck) => sum + (deck.dueToday || 0), 0),
      newCards: decks.reduce((sum, deck) => sum + (deck.newCards || 0), 0),
      learnedCards: decks.reduce((sum, deck) => sum + (deck.learnedCards || 0), 0),
    }),
    [decks],
  );

  return { decks, loading, error, totals };
}
