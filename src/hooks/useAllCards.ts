import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import type { Flashcard } from "../types";

export function useAllCards(uid?: string) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onValue(
      ref(database, `cards/${uid}`),
      (snapshot) => {
        if (!snapshot.exists()) {
          setCards([]);
          setLoading(false);
          return;
        }
        const raw = snapshot.val() as Record<string, Omit<Flashcard, "id"> & { id?: string }>;
        setCards(Object.entries(raw).map(([key, value]) => ({ ...value, id: value.id || key } as Flashcard)));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, [uid]);

  return { cards, loading };
}
