import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../lib/firebase";
import { localDateKey, streakFromReviews } from "../lib/studyAnalytics";
import type { ReviewRecord } from "../types";

export function useStudyStats(uid?: string) {
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
        setReviews(Object.entries(raw).map(([key, value]) => ({ ...value, id: value.id || key })));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, [uid]);

  const stats = useMemo(() => {
    const today = localDateKey(new Date());
    const todayReviews = reviews.filter((review) => localDateKey(review.reviewedAt) === today);
    return {
      // Mantido como alias por compatibilidade com telas antigas.
      studiedToday: todayReviews.length,
      reviewsToday: todayReviews.length,
      uniqueCardsToday: new Set(todayReviews.map((review) => review.cardId)).size,
      uniqueCardsStudied: new Set(reviews.map((review) => review.cardId)).size,
      streakDays: streakFromReviews(reviews),
      totalReviews: reviews.length,
      reviews,
    };
  }, [reviews]);

  return { ...stats, loading };
}
