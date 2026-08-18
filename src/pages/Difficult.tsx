import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useAllCards } from "../hooks/useAllCards";
import { useDecks } from "../hooks/useDecks";
import { useReviews } from "../hooks/useReviews";
import { latestReviewForCard, reviewsForCard } from "../lib/reviewScheduling";

export default function Difficult() {
  const { user } = useAuth();
  const { cards, loading: cardsLoading } = useAllCards(user?.uid);
  const { reviews, loading: reviewsLoading } = useReviews(user?.uid);
  const { decks, loading: decksLoading } = useDecks(user?.uid);

  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const difficultCards = cards
    .map((card) => {
      const history = reviewsForCard(reviews, card.id);
      const latest = latestReviewForCard(reviews, card.id);
      const againCount = history.filter((review) => review.rating === "again").length;
      const hardCount = history.filter((review) => review.rating === "hard").length;
      return { card, latest, againCount, hardCount };
    })
    .filter(({ latest }) => latest?.rating === "again" || latest?.rating === "hard")
    .sort((a, b) => new Date(b.latest!.reviewedAt).getTime() - new Date(a.latest!.reviewedAt).getTime());

  const loading = cardsLoading || reviewsLoading || decksLoading;

  return (
    <div className="max-w-4xl">
      <div className="mb-7">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">REVISÃO ADAPTATIVA</div>
        <h1 className="font-display text-3xl text-ink-900 dark:text-paper mt-1">Cards difíceis</h1>
        <p className="text-sm text-ink-400 mt-2 max-w-2xl">
          Aqui aparecem cards cuja avaliação mais recente foi <strong className="font-medium text-ink-600 dark:text-paper">Errei</strong> ou <strong className="font-medium text-ink-600 dark:text-paper">Difícil</strong>. Se depois você avaliar como Bom ou Fácil, eles saem desta lista automaticamente.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[0, 1].map((item) => <div key={item} className="h-40 rounded-card bg-white/70 dark:bg-ink-900 border border-ink-100 dark:border-ink-800 animate-pulse" />)}
        </div>
      ) : difficultCards.length === 0 ? (
        <EmptyState
          title="Nenhum card difícil por aqui"
          description="Quando sua avaliação mais recente for Errei ou Difícil, o card aparecerá automaticamente nesta lista."
        />
      ) : (
        <div className="grid gap-4">
          {difficultCards.map(({ card, latest, againCount, hardCount }) => {
            const deck = deckById.get(card.deckId);
            const isAgain = latest!.rating === "again";
            return (
              <article key={card.id} className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="source-tab text-clinical-600 dark:text-clinical-300">{deck?.title || card.topic}</div>
                    <div className="text-xs text-ink-400 mt-1">{card.topic}</div>
                  </div>
                  <span className={isAgain
                    ? "rounded-full border border-signal-300/60 bg-signal-50 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-signal-700 dark:border-signal-800 dark:bg-signal-950/20 dark:text-signal-300"
                    : "rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
                  }>
                    {isAgain ? "Errei por último" : "Difícil por último"}
                  </span>
                </div>

                <h2 className="font-display text-xl leading-snug text-ink-900 dark:text-paper mt-5">{card.question}</h2>

                <div className="flex flex-wrap gap-4 text-xs text-ink-400 mt-5">
                  <span>{againCount} {againCount === 1 ? "erro" : "erros"}</span>
                  <span>{hardCount}× difícil</span>
                  <span>Última avaliação: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(latest!.reviewedAt))}</span>
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <Link to={`/study/${card.deckId}?scope=difficult`} className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2 text-sm font-medium">Estudar difíceis</Link>
                  <Link to={`/decks/${card.deckId}`} className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2 text-sm font-medium text-ink-700 dark:text-paper">Abrir deck</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
