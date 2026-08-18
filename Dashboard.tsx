import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import DeckCard from "../components/DeckCard";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { useStudyStats } from "../hooks/useStudyStats";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { decks, loading, totals } = useDecks(user?.uid);
  const { reviewsToday, uniqueCardsToday, streakDays } = useStudyStats(user?.uid);
  const firstName = profile?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || "de volta";
  const recentDecks = decks.slice(0, 4);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink-900 dark:text-paper">Olá, {firstName}</h1>
          <p className="text-ink-400 mt-1">Pronta para revisar?</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/study"
            className="rounded-lg bg-ink-900 dark:bg-clinical-600 text-paper px-4 py-2.5 text-sm font-medium hover:bg-ink-800 dark:hover:bg-clinical-500 transition-colors"
          >
            Começar revisão
          </Link>
          <Link
            to="/create/upload"
            className="rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
          >
            Criar flashcards
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Para revisar hoje" value={totals.dueToday} />
        <StatCard label="Novos" value={totals.newCards} />
        <StatCard
          label="Revisões hoje"
          value={reviewsToday}
          hint={reviewsToday > 0 ? `${uniqueCardsToday} ${uniqueCardsToday === 1 ? "card único" : "cards únicos"}` : undefined}
        />
        <StatCard label="Sequência" value={`${streakDays} ${streakDays === 1 ? "dia" : "dias"}`} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-ink-900 dark:text-paper">Seus decks</h2>
        <Link to="/library" className="text-sm text-clinical-600 dark:text-clinical-300 font-medium">
          Ver biblioteca
        </Link>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-32 rounded-card border border-ink-200/70 dark:border-ink-800 bg-white/70 dark:bg-ink-900 animate-pulse"
            />
          ))}
        </div>
      ) : recentDecks.length === 0 ? (
        <EmptyState
          title="Nenhum deck ainda"
          description="Crie seu primeiro deck na Biblioteca. A partir dele, você vai organizar os flashcards por especialidade e tema."
          action={
            <Link
              to="/library"
              className="inline-block rounded-lg border border-ink-200 dark:border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-700 dark:text-paper hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
            >
              Ir para a Biblioteca
            </Link>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {recentDecks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-ink-400">
          Suas revisões são organizadas automaticamente. “Para revisar hoje” reúne o que está na hora de rever, enquanto cards ainda não estudados aparecem em “Novos”.
        </p>
        <Link to="/statistics" className="text-xs font-medium text-clinical-600 dark:text-clinical-300 whitespace-nowrap">
          Ver desempenho →
        </Link>
      </div>
    </div>
  );
}
