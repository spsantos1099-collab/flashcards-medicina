import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useAllCards } from "../hooks/useAllCards";
import { useDecks } from "../hooks/useDecks";
import { cardMatchesQuery, normalizeSearchText, stripCloze } from "../lib/cardFilters";
import { setCardFavorite } from "../lib/database";

export default function SearchResults() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const { cards, loading: cardsLoading } = useAllCards(user?.uid);
  const { decks, loading: decksLoading } = useDecks(user?.uid);
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const deckById = useMemo(() => new Map(decks.map((deck) => [deck.id, deck])), [decks]);

  const matches = useMemo(() => {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];

    return cards.filter((card) => {
      if (cardMatchesQuery(card, query)) return true;
      const deck = deckById.get(card.deckId);
      if (!deck) return false;
      const deckText = normalizeSearchText([deck.title, deck.specialty, deck.topic || ""].join(" "));
      return normalized.split(" ").every((term) => deckText.includes(term));
    });
  }, [cards, deckById, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof matches>();
    matches.forEach((card) => {
      const current = map.get(card.deckId) || [];
      current.push(card);
      map.set(card.deckId, current);
    });
    return Array.from(map.entries()).map(([deckId, deckCards]) => ({
      deckId,
      deck: deckById.get(deckId),
      cards: deckCards,
    }));
  }, [deckById, matches]);

  const toggleFavorite = async (cardId: string, nextValue: boolean) => {
    if (!user) return;
    setFavoriteBusy(cardId);
    setActionError(null);
    try {
      await setCardFavorite(user.uid, cardId, nextValue);
    } catch (error) {
      console.error("Não foi possível atualizar o favorito.", error);
      setActionError("Não foi possível atualizar este favorito agora.");
    } finally {
      setFavoriteBusy(null);
    }
  };

  const loading = cardsLoading || decksLoading;

  return (
    <div className="max-w-5xl">
      <div className="mb-7">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">BUSCA GLOBAL</div>
        <h1 className="font-display text-3xl text-ink-900 dark:text-paper mt-1">
          {query ? `Resultados para “${query}”` : "Buscar no Fichário"}
        </h1>
        <p className="text-sm text-ink-400 mt-2 max-w-2xl">
          A busca considera pergunta, resposta, explicação, tema, tags e os metadados do deck. As respostas não são exibidas aqui para evitar entregar o conteúdo durante a navegação.
        </p>
      </div>

      {actionError && (
        <div className="mb-5 rounded-lg border border-signal-300/60 bg-signal-50/70 dark:border-signal-800 dark:bg-signal-950/20 px-4 py-3 text-sm text-signal-700 dark:text-signal-300">
          {actionError}
        </div>
      )}

      {!query ? (
        <EmptyState
          title="Digite um termo na busca acima"
          description="Você pode procurar por doença, medicamento, critério, tema ou uma palavra presente no conteúdo de qualquer card."
        />
      ) : loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-36 rounded-card border border-ink-100 dark:border-ink-800 bg-white/70 dark:bg-ink-900 animate-pulse" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          title="Nenhum card encontrado"
          description="Tente um termo mais curto ou outra palavra relacionada ao conteúdo que você procura."
        />
      ) : (
        <>
          <p className="text-sm text-ink-400 mb-5">
            {matches.length} {matches.length === 1 ? "card encontrado" : "cards encontrados"} em {grouped.length} {grouped.length === 1 ? "deck" : "decks"}.
          </p>

          <div className="space-y-7">
            {grouped.map(({ deckId, deck, cards: deckCards }) => (
              <section key={deckId}>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
                  <div>
                    <div className="source-tab text-clinical-600 dark:text-clinical-300">{deck?.specialty || "DECK"}</div>
                    <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">{deck?.title || "Deck removido"}</h2>
                    <p className="text-xs text-ink-400 mt-1">{deckCards.length} resultado(s) neste deck</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/study/${deckId}?scope=all&q=${encodeURIComponent(query)}`}
                      className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-3.5 py-2 text-xs font-medium"
                    >
                      Estudar resultados
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
                    <article key={card.id} className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="source-tab text-clinical-600 dark:text-clinical-300">
                            {card.type === "basic" ? "BÁSICO" : card.type === "cloze" ? "CLOZE" : "CASO CLÍNICO"} · {card.topic}
                          </div>
                          <h3 className="font-display text-lg leading-snug text-ink-900 dark:text-paper mt-2">
                            {stripCloze(card.question)}
                          </h3>
                          <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-ink-400">
                            <span>{card.difficulty === "easy" ? "Fácil" : card.difficulty === "hard" ? "Difícil" : "Média"}</span>
                            {(card.tags || []).slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleFavorite(card.id, !card.isFavorite)}
                          disabled={favoriteBusy === card.id}
                          aria-label={card.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          className={`text-xl leading-none shrink-0 ${card.isFavorite ? "text-clinical-600 dark:text-clinical-300" : "text-ink-300 dark:text-ink-600"}`}
                        >
                          {card.isFavorite ? "★" : "☆"}
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
