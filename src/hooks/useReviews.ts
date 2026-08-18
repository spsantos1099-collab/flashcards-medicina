import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import type { ReviewRecord } from "../types";

function sortReviews(reviews: ReviewRecord[]) {
  return [...reviews].sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime());
}

export function useReviews(uid?: string, deckId?: string) {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setReviews([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onValue(
      ref(database, `reviews/${uid}`),
      (snapshot) => {
        if (!snapshot.exists()) {
          setReviews([]);
          setLoading(false);
          return;
        }
        const raw = snapshot.val() as Record<string, Omit<ReviewRecord, "id"> & { id?: string }>;
        const parsed = Object.entries(raw).map(([key, value]) => ({ ...value, id: value.id || key }));
        setReviews(sortReviews(parsed));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, [uid]);

  const filtered = useMemo(
    () => (deckId ? reviews.filter((review) => review.deckId === deckId) : reviews),
    [deckId, reviews],
  );

  return { reviews: filtered, allReviews: reviews, loading };
}
