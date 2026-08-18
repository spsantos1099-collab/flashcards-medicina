import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useAllCards } from "../hooks/useAllCards";
import { useDecks } from "../hooks/useDecks";
import { setCardFavorite } from "../lib/database";
import { stripCloze } from "../lib/cardFilters";

export default function Favorites() {
  const { user } = useAuth();
  const { cards, loading: cardsLoading } = useAllCards(user?.uid);
  const { decks, loading: decksLoading } = useDecks(user?.uid);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const deckById = useMemo(() => new Map(decks.map((deck) => [deck.id, deck])), [decks]);
  const favorites = useMemo(() => cards.filter((card) => Boolean(card.isFavorite)), [cards]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof favorites>();
    favorites.forEach((card) => {
      const current = map.get(card.deckId) || [];
      current.push(card);
      map.set(card.deckId, current);
    });
    return Array.from(map.entries()).map(([deckId, deckCards]) => ({
      deckId,
      deck: deckById.get(deckId),
      cards: deckCards,
    }));
  }, [deckById, favorites]);

  const removeFavorite = async (cardId: string) => {
    if (!user) return;
    setBusyId(cardId);
    setActionError(null);
    try {
      await setCardFavorite(user.uid, cardId, false);
    } catch (error) {
      console.error("Não foi possível remover o favorito.", error);
      setActionError("Não foi possível atualizar este favorito agora.");
    } finally {
      setBusyId(null);
    }
  };

  const loading = cardsLoading || decksLoading;

  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">COLEÇÃO PESSOAL</div>
        <h1 className="font-display text-3xl text-ink-900 dark:text-paper mt-1">Favoritos</h1>
        <p className="text-sm text-ink-400 mt-2 max-w-2xl">
          Favorite cards no deck ou durante uma sessão. A seleção fica salva na sua conta e pode ser estudada separadamente.
        </p>
      </div>

      {actionError && (
        <div className="mb-5 rounded-lg border border-signal-300/60 bg-signal-50/70 dark:border-signal-800 dark:bg-signal-950/20 px-4 py-3 text-sm text-signal-700 dark:text-signal-300">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          {[0, 1].map((item) => <div key={item} className="h-36 rounded-card bg-white/70 dark:bg-ink-900 border border-ink-100 dark:border-ink-800 animate-pulse" />)}
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          description="Use a estrela ☆ em um card para adicioná-lo aqui. Você pode favoritar tanto no deck quanto durante o estudo."
        />
      ) : (
        <>
          <p className="text-sm text-ink-400 mb-5">{favorites.length} {favorites.length === 1 ? "card favorito" : "cards favoritos"}.</p>
          <div className="space-y-8">
            {groups.map(({ deckId, deck, cards: deckCards }) => (
              <section key={deckId}>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
                  <div>
                    <div className="source-tab text-clinical-600 dark:text-clinical-300">{deck?.specialty || "DECK"}</div>
                    <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">{deck?.title || "Deck removido"}</h2>
                    <p className="text-xs text-ink-400 mt-1">{deckCards.length} favorito(s)</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/study/${deckId}?scope=favorites`}
                      className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-3.5 py-2 text-xs font-medium"
                    >
                      Estudar favoritos
                    </Link>
                    <Link
                      to={`/decks/${deckId}`}
                      className="rounded-lg border border-ink-200 dark:border-ink-700 px-3.5 py-2 text-xs font-medium text-ink-700 dark:text-paper"
                    >
                      Abrir deck
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3">
                  {deckCards.map((card) => (
                    <article key={card.id} className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="source-tab text-clinical-600 dark:text-clinical-300">
                            {card.type === "basic" ? "BÁSICO" : card.type === "cloze" ? "CLOZE" : "CASO CLÍNICO"} · {card.topic}
                          </div>
                          <h3 className="font-display text-lg leading-snug text-ink-900 dark:text-paper mt-2">{stripCloze(card.question)}</h3>
                          <div className="text-xs text-ink-400 mt-3">{card.difficulty === "easy" ? "Fácil" : card.difficulty === "hard" ? "Difícil" : "Média"}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeFavorite(card.id)}
                          disabled={busyId === card.id}
                          aria-label="Remover dos favoritos"
                          title="Remover dos favoritos"
                          className="text-xl leading-none text-clinical-600 dark:text-clinical-300 disabled:opacity-50"
                        >
                          ★
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
