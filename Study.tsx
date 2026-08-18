import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import StudyCard from "../components/StudyCard";
import { useAuth } from "../contexts/AuthContext";
import { useCards } from "../hooks/useCards";
import { useDecks } from "../hooks/useDecks";
import { useReviews } from "../hooks/useReviews";
import {
  createStudySession,
  recordStudyRating,
  setCardFavorite,
  updateStudySessionProgress,
} from "../lib/database";
import {
  buildFilteredStudyQueue,
  defaultStudyFilters,
  filterCardAttributes,
  studyScopeLabels,
  type StudyFilters,
  type StudyScope,
} from "../lib/cardFilters";
import { nextScheduledDate } from "../lib/reviewScheduling";
import type { CardType, Difficulty, Flashcard, ReviewRating, StudySessionRecord } from "../types";

const emptyRatings: Record<ReviewRating, number> = { again: 0, hard: 0, good: 0, easy: 0 };
const validScopes = new Set<StudyScope>(["queue", "due", "new", "favorites", "difficult", "all"]);
const validTypes = new Set<CardType>(["basic", "cloze", "clinical_case"]);
const validDifficulties = new Set<Difficulty>(["easy", "medium", "hard"]);

function formatNextReview(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function readFilters(searchParams: URLSearchParams): StudyFilters {
  const rawScope = searchParams.get("scope") as StudyScope | null;
  const rawType = searchParams.get("type") as CardType | null;
  const rawDifficulty = searchParams.get("difficulty") as Difficulty | null;
  return {
    scope: rawScope && validScopes.has(rawScope) ? rawScope : defaultStudyFilters.scope,
    type: rawType && validTypes.has(rawType) ? rawType : "all",
    difficulty: rawDifficulty && validDifficulties.has(rawDifficulty) ? rawDifficulty : "all",
    query: searchParams.get("q")?.trim() || "",
  };
}

export default function Study() {
  const { deckId } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const filterKey = `${filters.scope}|${filters.type}|${filters.difficulty}|${filters.query}`;

  const { cards, loading, error } = useCards(user?.uid, deckId);
  const { reviews, loading: reviewsLoading } = useReviews(user?.uid, deckId);
  const { decks, loading: decksLoading } = useDecks(user?.uid);

  const [sessionCards, setSessionCards] = useState<Flashcard[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<ReviewRating, number>>(emptyRatings);
  const [searchDraft, setSearchDraft] = useState(filters.query);
  const sessionPromiseRef = useRef<Promise<StudySessionRecord> | null>(null);

  const availableDecks = useMemo(() => decks.filter((deck) => deck.totalCards > 0), [decks]);

  useEffect(() => {
    setSearchDraft(filters.query);
  }, [filters.query]);

  useEffect(() => {
    setSessionCards(null);
    setCurrentIndex(0);
    setRevealed(false);
    setBusy(false);
    setActionError(null);
    setRatings(emptyRatings);
    sessionPromiseRef.current = null;
  }, [deckId, filterKey]);

  useEffect(() => {
    if (!deckId || loading || reviewsLoading || sessionCards !== null) return;
    setSessionCards(buildFilteredStudyQueue(cards, reviews, filters, new Date()));
  }, [cards, deckId, filters, loading, reviews, reviewsLoading, sessionCards]);

  const studyCards = sessionCards ?? [];
  const currentCard = studyCards[currentIndex];
  const completed = Boolean(deckId && studyCards.length > 0 && currentIndex >= studyCards.length);
  const reviewedCount = Math.min(currentIndex, studyCards.length);
  const progress = studyCards.length ? Math.round((reviewedCount / studyCards.length) * 100) : 0;
  const nextReview = useMemo(() => nextScheduledDate(cards, reviews, new Date()), [cards, reviews]);

  const ensureSession = useCallback(async () => {
    if (!user || !deckId) throw new Error("Sessão de estudo indisponível.");
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = createStudySession(user.uid, deckId);
    }
    return sessionPromiseRef.current;
  }, [deckId, user]);

  const handleRate = useCallback(async (rating: ReviewRating) => {
    if (!user || !deckId || !currentCard || busy) return;

    setBusy(true);
    setActionError(null);
    try {
      const session = await ensureSession();
      await recordStudyRating(user.uid, deckId, currentCard, rating);
      const nextReviewed = currentIndex + 1;
      await updateStudySessionProgress(user.uid, session.id, nextReviewed, nextReviewed >= studyCards.length);
      setRatings((current) => ({ ...current, [rating]: current[rating] + 1 }));
      setCurrentIndex(nextReviewed);
      setRevealed(false);
    } catch (error) {
      console.error("Não foi possível registrar a avaliação.", error);
      setActionError("Não foi possível salvar esta avaliação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [busy, currentCard, currentIndex, deckId, ensureSession, studyCards.length, user]);

  const handleToggleFavorite = useCallback(async () => {
    if (!user || !currentCard || favoriteBusyId) return;
    const nextValue = !currentCard.isFavorite;
    setFavoriteBusyId(currentCard.id);
    setActionError(null);
    try {
      await setCardFavorite(user.uid, currentCard.id, nextValue);
      setSessionCards((current) => current?.map((card) => (
        card.id === currentCard.id ? { ...card, isFavorite: nextValue } : card
      )) ?? null);
    } catch (error) {
      console.error("Não foi possível atualizar o favorito.", error);
      setActionError("Não foi possível atualizar o favorito agora.");
    } finally {
      setFavoriteBusyId(null);
    }
  }, [currentCard, favoriteBusyId, user]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable) return;
      if (!currentCard || completed || busy) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }

      if (!revealed) return;
      const ratingByKey: Record<string, ReviewRating> = {
        Digit1: "again",
        Digit2: "hard",
        Digit3: "good",
        Digit4: "easy",
        Numpad1: "again",
        Numpad2: "hard",
        Numpad3: "good",
        Numpad4: "easy",
      };
      const rating = ratingByKey[event.code];
      if (rating) {
        event.preventDefault();
        void handleRate(rating);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, completed, currentCard, handleRate, revealed]);

  const updateFilter = (key: "scope" | "type" | "difficulty", value: string) => {
    const next = new URLSearchParams(searchParams);
    const defaults = { scope: "queue", type: "all", difficulty: "all" };
    if (value === defaults[key]) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const submitQuery = () => {
    const next = new URLSearchParams(searchParams);
    const value = searchDraft.trim();
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const restartQueue = () => {
    setSessionCards(buildFilteredStudyQueue(cards, reviews, filters, new Date()));
    setCurrentIndex(0);
    setRevealed(false);
    setRatings(emptyRatings);
    setActionError(null);
    sessionPromiseRef.current = null;
  };

  const studyAllMatchingAttributes = () => {
    setSessionCards(filterCardAttributes(cards, { ...filters, scope: "all" }));
    setCurrentIndex(0);
    setRevealed(false);
    setRatings(emptyRatings);
    setActionError(null);
    sessionPromiseRef.current = null;
  };

  if (!deckId) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">REVISÃO DO DIA</div>
        <h1 className="font-display text-3xl text-ink-900 dark:text-paper mt-1">Escolha o que estudar</h1>
        <p className="text-sm text-ink-400 mt-2">
          Abra um deck e use os filtros para revisar somente vencidos, novos, favoritos, difíceis, um tipo de card ou uma dificuldade específica.
        </p>

        {decksLoading ? (
          <p className="text-sm text-ink-400 mt-8">Carregando seus decks…</p>
        ) : availableDecks.length === 0 ? (
          <div className="mt-8 rounded-card border border-dashed border-ink-200 dark:border-ink-800 px-6 py-8">
            <h2 className="font-display text-xl text-ink-900 dark:text-paper">Nenhum deck com cards</h2>
            <p className="text-sm text-ink-400 mt-2">Gere e salve flashcards antes de iniciar uma sessão.</p>
            <Link to="/library" className="inline-flex mt-5 text-sm font-medium text-clinical-600 dark:text-clinical-300">Ir para Biblioteca</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            {availableDecks.map((deck) => (
              <Link
                key={deck.id}
                to={`/study/${deck.id}`}
                className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card hover:border-clinical-400 transition-colors"
              >
                <div className="source-tab text-clinical-600 dark:text-clinical-300">{deck.specialty}</div>
                <h2 className="font-display text-xl text-ink-900 dark:text-paper mt-1">{deck.title}</h2>
                {deck.topic && <p className="text-sm text-ink-400 mt-1">{deck.topic}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400 mt-4">
                  <span>{deck.dueToday} para revisar</span>
                  <span>{deck.newCards} novos</span>
                  <span>{deck.learnedCards} aprendidos</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading || reviewsLoading || sessionCards === null) {
    return <div className="max-w-xl mx-auto text-sm text-ink-400">Montando sua sessão de estudo…</div>;
  }

  if (error || cards.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <div className="source-tab text-clinical-600 dark:text-clinical-300">ESTUDO</div>
        <h1 className="font-display text-2xl text-ink-900 dark:text-paper mt-2">Ainda não há cards para estudar</h1>
        <p className="text-sm text-ink-400 mt-2">{error || "Salve flashcards no deck primeiro."}</p>
        <Link to={`/decks/${deckId}`} className="inline-flex mt-5 text-sm font-medium text-clinical-600 dark:text-clinical-300">Voltar ao deck</Link>
      </div>
    );
  }

  const filterPanel = (
    <StudyFilterPanel
      filters={filters}
      searchDraft={searchDraft}
      setSearchDraft={setSearchDraft}
      onSubmitQuery={submitQuery}
      onUpdateFilter={updateFilter}
      onClear={clearFilters}
    />
  );

  if (studyCards.length === 0) {
    const isDefaultQueue = filters.scope === "queue" && filters.type === "all" && filters.difficulty === "all" && !filters.query;
    return (
      <div className="max-w-xl mx-auto py-6">
        {filterPanel}
        <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-7 text-center">
          <div className="source-tab text-clinical-600 dark:text-clinical-300">{studyScopeLabels[filters.scope].toUpperCase()}</div>
          <h1 className="font-display text-3xl text-ink-900 dark:text-paper mt-2">
            {isDefaultQueue ? "Tudo em dia" : "Nenhum card neste filtro"}
          </h1>
          <p className="text-sm text-ink-400 mt-2">
            {isDefaultQueue
              ? "Não há cards vencidos nem cards novos neste deck agora."
              : "A combinação atual de origem, tipo, dificuldade e busca não encontrou cards para esta sessão."}
          </p>
          {isDefaultQueue && nextReview && (
            <p className="text-xs text-ink-400 mt-3">Próxima revisão programada: {formatNextReview(nextReview)}.</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 mt-7 justify-center">
            {filters.scope === "queue" && (
              <button type="button" onClick={studyAllMatchingAttributes} className="rounded-lg border border-ink-200 dark:border-ink-700 px-5 py-2.5 text-sm font-medium text-ink-700 dark:text-paper">
                Estudar todos mesmo assim
              </button>
            )}
            {!isDefaultQueue && (
              <button type="button" onClick={clearFilters} className="rounded-lg border border-ink-200 dark:border-ink-700 px-5 py-2.5 text-sm font-medium text-ink-700 dark:text-paper">
                Limpar filtros
              </button>
            )}
            <Link to={`/decks/${deckId}`} className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-5 py-2.5 text-sm font-medium">Voltar ao deck</Link>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="max-w-xl mx-auto py-6">
        {filterPanel}
        <div className="rounded-card border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card p-7 text-center">
          <div className="source-tab text-clinical-600 dark:text-clinical-300">SESSÃO CONCLUÍDA</div>
          <h1 className="font-display text-3xl text-ink-900 dark:text-paper mt-2">Revisão finalizada</h1>
          <p className="text-sm text-ink-400 mt-2">{studyCards.length} {studyCards.length === 1 ? "card estudado" : "cards estudados"}. As próximas revisões foram agendadas.</p>

          <div className="grid grid-cols-4 gap-2 mt-7 text-center">
            <ResultStat label="Errei" value={ratings.again} />
            <ResultStat label="Difícil" value={ratings.hard} />
            <ResultStat label="Bom" value={ratings.good} />
            <ResultStat label="Fácil" value={ratings.easy} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-7 justify-center">
            <button type="button" onClick={restartQueue} className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-5 py-2.5 text-sm font-medium">Refazer este filtro</button>
            <Link to={`/decks/${deckId}`} className="rounded-lg border border-ink-200 dark:border-ink-700 px-5 py-2.5 text-sm font-medium text-ink-700 dark:text-paper">Voltar ao deck</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-xl mx-auto">
        {filterPanel}
      </div>

      <div className="max-w-xl mx-auto mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="source-tab text-clinical-600 dark:text-clinical-300">{studyScopeLabels[filters.scope].toUpperCase()}</div>
          <p className="text-sm text-ink-400 mt-1">Card {currentIndex + 1} de {studyCards.length}</p>
        </div>
        <Link to={`/decks/${deckId}`} className="text-sm text-ink-400 hover:text-clinical-600 transition-colors">Sair da sessão</Link>
      </div>

      <div className="max-w-xl mx-auto mb-6">
        <div className="flex items-center justify-between text-[11px] text-ink-400 mb-2">
          <span>{reviewedCount} concluídos</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
          <div className="h-full bg-clinical-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {actionError && (
        <div className="max-w-xl mx-auto mb-4 rounded-lg border border-signal-300/60 bg-signal-50/70 dark:border-signal-800 dark:bg-signal-950/20 px-4 py-3 text-sm text-signal-700 dark:text-signal-300">
          {actionError}
        </div>
      )}

      {currentCard && (
        <StudyCard
          key={currentCard.id}
          card={currentCard}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onRate={handleRate}
          onToggleFavorite={handleToggleFavorite}
          busy={busy}
          favoriteBusy={favoriteBusyId === currentCard.id}
        />
      )}

      <p className="max-w-xl mx-auto mt-5 text-center text-xs text-ink-400">
        Espaço revela a resposta · 1 Errei · 2 Difícil · 3 Bom · 4 Fácil
      </p>
    </div>
  );
}

function StudyFilterPanel({
  filters,
  searchDraft,
  setSearchDraft,
  onSubmitQuery,
  onUpdateFilter,
  onClear,
}: {
  filters: StudyFilters;
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  onSubmitQuery: () => void;
  onUpdateFilter: (key: "scope" | "type" | "difficulty", value: string) => void;
  onClear: () => void;
}) {
  const hasFilter = filters.scope !== "queue" || filters.type !== "all" || filters.difficulty !== "all" || Boolean(filters.query);

  return (
    <details className="mb-6 rounded-lg border border-ink-200/70 dark:border-ink-800 bg-white/70 dark:bg-ink-900">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="source-tab text-clinical-600 dark:text-clinical-300">FILTROS DA SESSÃO</div>
          <div className="text-sm text-ink-600 dark:text-ink-200 mt-0.5">
            {studyScopeLabels[filters.scope]}
            {filters.type !== "all" ? ` · ${filters.type === "basic" ? "Básico" : filters.type === "cloze" ? "Cloze" : "Caso clínico"}` : ""}
            {filters.difficulty !== "all" ? ` · ${filters.difficulty === "easy" ? "Fácil" : filters.difficulty === "hard" ? "Difícil" : "Média"}` : ""}
            {filters.query ? ` · “${filters.query}”` : ""}
          </div>
        </div>
        <span className="text-xs text-ink-400">ajustar</span>
      </summary>

      <div className="border-t border-ink-100 dark:border-ink-800 p-4 grid sm:grid-cols-3 gap-3">
        <label className="text-xs text-ink-400">
          Origem
          <select
            value={filters.scope}
            onChange={(event) => onUpdateFilter("scope", event.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 px-3 py-2 text-sm text-ink-800 dark:text-paper"
          >
            <option value="queue">Fila do dia</option>
            <option value="due">Vencidos</option>
            <option value="new">Novos</option>
            <option value="favorites">Favoritos</option>
            <option value="difficult">Cards difíceis</option>
            <option value="all">Todos os cards</option>
          </select>
        </label>

        <label className="text-xs text-ink-400">
          Tipo
          <select
            value={filters.type}
            onChange={(event) => onUpdateFilter("type", event.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 px-3 py-2 text-sm text-ink-800 dark:text-paper"
          >
            <option value="all">Todos os tipos</option>
            <option value="basic">Básico</option>
            <option value="cloze">Cloze</option>
            <option value="clinical_case">Caso clínico</option>
          </select>
        </label>

        <label className="text-xs text-ink-400">
          Dificuldade
          <select
            value={filters.difficulty}
            onChange={(event) => onUpdateFilter("difficulty", event.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 px-3 py-2 text-sm text-ink-800 dark:text-paper"
          >
            <option value="all">Todas</option>
            <option value="easy">Fácil</option>
            <option value="medium">Média</option>
            <option value="hard">Difícil</option>
          </select>
        </label>

        <form
          className="sm:col-span-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitQuery();
          }}
        >
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Filtrar por palavra dentro deste deck…"
            className="flex-1 min-w-0 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 px-3 py-2 text-sm text-ink-800 dark:text-paper"
          />
          <button type="submit" className="rounded-lg border border-ink-200 dark:border-ink-700 px-3.5 py-2 text-sm font-medium text-ink-700 dark:text-paper">
            Aplicar
          </button>
          {hasFilter && (
            <button type="button" onClick={onClear} className="rounded-lg px-3 py-2 text-sm text-ink-400 hover:text-signal-600">
              Limpar
            </button>
          )}
        </form>
      </div>
    </details>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink-100 dark:border-ink-800 px-2 py-3">
      <div className="font-display text-xl text-ink-900 dark:text-paper">{value}</div>
      <div className="text-[11px] text-ink-400 mt-0.5">{label}</div>
    </div>
  );
}
