import { Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import DeckCard from "../components/DeckCard";
import { mockSummary, mockDecks } from "../lib/mockData";

// TODO (Fase 3): substituir mockSummary/mockDecks por dados reais do
// Realtime Database (users/{uid}, decks/{uid}).
export default function Dashboard() {
  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink-900 dark:text-paper">Olá, Ana 👋</h1>
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
            Criar flashcards com IA
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Para revisar hoje" value={mockSummary.dueToday} />
        <StatCard label="Novos" value={mockSummary.newCards} />
        <StatCard label="Estudados hoje" value={mockSummary.studiedToday} />
        <StatCard label="Sequência" value={`${mockSummary.streakDays} dias`} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-ink-900 dark:text-paper">Seus decks</h2>
        <Link to="/library" className="text-sm text-clinical-600 dark:text-clinical-300 font-medium">
          Ver biblioteca
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {mockDecks.map((deck) => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>
    </div>
  );
}
