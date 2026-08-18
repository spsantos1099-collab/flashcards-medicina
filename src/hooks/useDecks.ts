import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import { isDueByEndOfToday, isNewCard } from "../lib/reviewScheduling";
import type { Deck } from "../types";
import { useAllCards } from "./useAllCards";
import { useReviews } from "./useReviews";

function sortDecks(decks: Deck[]) {
  return [...decks].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return bTime - aTime;
  });
}

export function useDecks(uid?: string) {
  const [storedDecks, setStoredDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);
  const { cards, loading: cardsLoading } = useAllCards(uid);
  const { reviews, loading: reviewsLoading } = useReviews(uid);

  useEffect(() => {
    if (!uid) {
      setStoredDecks([]);
      setDecksLoading(false);
      setError(null);
      return;
    }

    setDecksLoading(true);
    setError(null);

    const decksRef = ref(database, `decks/${uid}`);
    const unsubscribe = onValue(
      decksRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setStoredDecks([]);
          setDecksLoading(false);
          return;
        }

        const raw = snapshot.val() as Record<string, Omit<Deck, "id"> & { id?: string }>;
        const parsed = Object.entries(raw).map(([key, value]) => ({
          ...value,
          id: value.id || key,
        })) as Deck[];

        setStoredDecks(sortDecks(parsed));
        setDecksLoading(false);
      },
      () => {
        setError("Não foi possível carregar seus decks agora. Tente novamente em instantes.");
        setDecksLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  const decks = useMemo(() => {
    const now = new Date();
    return storedDecks.map((deck) => {
      const deckCards = cards.filter((card) => card.deckId === deck.id);
      const newCards = deckCards.filter((card) => isNewCard(reviews, card.id)).length;
      const dueToday = deckCards.filter((card) => !isNewCard(reviews, card.id) && isDueByEndOfToday(reviews, card.id, now)).length;
      return {
        ...deck,
        totalCards: deckCards.length,
        newCards,
        learnedCards: Math.max(0, deckCards.length - newCards),
        dueToday,
      };
    });
  }, [cards, reviews, storedDecks]);

  const totals = useMemo(
    () => ({
      totalCards: decks.reduce((sum, deck) => sum + deck.totalCards, 0),
      dueToday: decks.reduce((sum, deck) => sum + deck.dueToday, 0),
      newCards: decks.reduce((sum, deck) => sum + deck.newCards, 0),
      learnedCards: decks.reduce((sum, deck) => sum + deck.learnedCards, 0),
    }),
    [decks],
  );

  return {
    decks,
    loading: decksLoading || cardsLoading || reviewsLoading,
    error,
    totals,
  };
}
